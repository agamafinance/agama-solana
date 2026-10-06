// agama-agents: Agama's permissionless agents, run by Chainlink CRE instead of
// a keeper.
//
// Every minute, in three steps:
//   1. read (node mode, HTTP): the protocol, the ten markets and every
//      position, plus a recent blockhash. Each node decides which positions
//      need `compound` or `rebalance` with the program's own math, and the DON
//      must agree on that list and on the blockhash (identical consensus). Two
//      nodes that see different state make the run stop: nothing is sent.
//   2. sign (DON mode): the agreed transactions, with the agent key from CRE
//      secrets. Ed25519 is deterministic, so every node signs the same bytes.
//   3. send (node mode, HTTP): each node sends those identical bytes; Solana
//      keeps one. The RPC preflight still refuses anything that turned out to
//      have nothing to do, for free.
//
// HTTP calls per run: 3 reads + at most maxActions sends, under the 15 a CRE
// execution allows.
//
// Why not a signed report through the Keystone Forwarder, like the prices: an
// agent action needs ten accounts, and a CRE Solana write has no address
// lookup tables yet (~265 bytes left before accounts). The instructions are
// permissionless: the workflow is one of the signers anyone could be.
//
// The agent key is a CRE secret, so under a DON every node operator can read
// it. It only pays fees and signs permissionless calls; production would run
// the signing step as a Confidential Workflow (handlerInTee).
import {
	ConsensusAggregationByFields,
	consensusIdenticalAggregation,
	CronCapability,
	handler,
	HTTPClient,
	type HTTPSendRequester,
	median,
	Runner,
	type Runtime,
} from '@chainlink/cre-sdk'
import { Keypair, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js'
import { z } from 'zod'

const configSchema = z.object({
	schedule: z.string(),
	rpcUrl: z.string(),
	programId: z.string(),
	markets: z.array(z.string()),
	maxActions: z.number(),
})
type Config = z.infer<typeof configSchema>

const TOKEN_2022 = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
const POSITION_DISC = [170, 188, 143, 228, 122, 64, 247, 208]
const OPS = { compound: [165, 208, 251, 78, 242, 160, 141, 47], rebalance: [108, 158, 77, 9, 210, 52, 88, 62] }
const WAD = 10n ** 18n
const BPS = 10_000n
const YEAR = 365n * 24n * 3600n
const BAND_BPS = 100n
const enc = (s: string) => new TextEncoder().encode(s)

// --- base58 / base64, no Buffer in the workflow runtime --------------------

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
function b58decode(s: string): Uint8Array {
	let n = 0n
	for (const c of s) n = n * 58n + BigInt(B58.indexOf(c))
	const out: number[] = []
	while (n > 0n) {
		out.unshift(Number(n % 256n))
		n /= 256n
	}
	for (const c of s) {
		if (c !== '1') break
		out.unshift(0)
	}
	return Uint8Array.from(out)
}
function b58encode(b: Uint8Array): string {
	let n = 0n
	for (const x of b) n = n * 256n + BigInt(x)
	let s = ''
	while (n > 0n) {
		s = B58[Number(n % 58n)] + s
		n /= 58n
	}
	for (const x of b) {
		if (x !== 0) break
		s = '1' + s
	}
	return s
}
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
function b64decode(s: string): Uint8Array {
	const out: number[] = []
	let buf = 0
	let bits = 0
	for (const ch of s.replace(/=+$/, '')) {
		buf = (buf << 6) | B64.indexOf(ch)
		bits += 6
		if (bits >= 8) {
			bits -= 8
			out.push((buf >> bits) & 0xff)
		}
	}
	return Uint8Array.from(out)
}
function b64encode(b: Uint8Array): string {
	let s = ''
	for (let i = 0; i < b.length; i += 3) {
		const n = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0)
		s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63]
		s += i + 1 < b.length ? B64[(n >> 6) & 63] : '='
		s += i + 2 < b.length ? B64[n & 63] : '='
	}
	return s
}

// --- little-endian readers ---------------------------------------------------

const u = (d: Uint8Array, o: number, n: number) => {
	let v = 0n
	for (let i = n - 1; i >= 0; i--) v = (v << 8n) | BigInt(d[o + i])
	return v
}
const i64 = (d: Uint8Array, o: number) => BigInt.asIntN(64, u(d, o, 8))

// --- JSON-RPC over the HTTP capability --------------------------------------

const rpc = (req: HTTPSendRequester, url: string, method: string, params: unknown[]): any => {
	const body = enc(JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }))
	const resp = req.sendRequest({ url, method: 'POST' as const, headers: { 'Content-Type': 'application/json' }, body }).result()
	if (resp.statusCode !== 200) throw new Error(`${method}: HTTP ${resp.statusCode}`)
	return JSON.parse(new TextDecoder().decode(resp.body))
}

type Action = { position: string; market: string; op: 'compound' | 'rebalance' }
type Plan = { blockhash: string; actions: Action[] }

const accounts = (config: Config) => {
	const program = new PublicKey(config.programId)
	const pda = (...seeds: Uint8Array[]) => PublicKey.findProgramAddressSync(seeds, program)[0]
	const symbolBytes = (s: string) => {
		const b = new Uint8Array(8)
		b.set(enc(s))
		return b
	}
	const markets = config.markets.map((sym) => {
		const stockMint = pda(enc('stock.v2'), symbolBytes(sym))
		const market = pda(enc('market.v2'), stockMint.toBytes())
		return { sym, market, stockMint, custody: pda(enc('custody.v2'), market.toBytes()) }
	})
	return {
		program,
		protocol: pda(enc('protocol.v2')),
		usdcMint: pda(enc('usdc.v2')),
		poolUsdc: pda(enc('pool_usdc.v2')),
		vaultUsdc: pda(enc('vault_usdc.v2')),
		markets,
	}
}

/**
 * Step 1, per node: read everything and decide, with the program's math
 * (accrual to now, the 1% band, the 0.1% compound margin, the session LTV).
 * Returns a canonical JSON plan so the DON can require identical answers.
 */
const plan = (req: HTTPSendRequester, config: Config, nowS: number): string => {
	const a = accounts(config)
	const keys = [a.protocol.toBase58(), ...a.markets.map((m) => m.market.toBase58())]
	const infos = rpc(req, config.rpcUrl, 'getMultipleAccounts', [keys, { encoding: 'base64', commitment: 'confirmed' }]).result.value
	const positions = rpc(req, config.rpcUrl, 'getProgramAccounts', [
		config.programId,
		{ encoding: 'base64', commitment: 'confirmed', filters: [{ memcmp: { offset: 0, bytes: b58encode(Uint8Array.from(POSITION_DISC)) } }] },
	]).result as { pubkey: string; account: { data: [string, string] } }[]
	const blockhash = rpc(req, config.rpcUrl, 'getLatestBlockhash', [{ commitment: 'finalized' }]).result.value.blockhash as string

	// Protocol (offsets checked against the IDL): cash @201, total_scaled_debt @209,
	// borrow_index @225, last_accrual @241, rates @249.., min_borrow @265,
	// nav_wad @281, vault_apr @297, min_compound @317.
	const p = b64decode(infos[0].data[0])
	const cash = u(p, 201, 8)
	const tsd = u(p, 209, 16)
	let index = u(p, 225, 16)
	const last = i64(p, 241)
	const [base, s1, s2, kink] = [u(p, 249, 4), u(p, 253, 4), u(p, 257, 4), u(p, 261, 4)]
	const minBorrow = u(p, 265, 8)
	let nav = u(p, 281, 16)
	const apr = u(p, 297, 4)
	const minCompound = u(p, 317, 8)
	const dt = BigInt(Math.max(0, nowS - Number(last)))
	const debtTotal = (tsd * index) / WAD
	const util = debtTotal + cash === 0n ? 0n : (debtTotal * BPS) / (debtTotal + cash)
	const rate = util <= kink ? base + (s1 * util) / kink : base + s1 + (s2 * (util - kink)) / (BPS - kink)
	index += (index * rate * dt) / (BPS * YEAR)
	nav += (nav * apr * dt) / (BPS * YEAR)

	// Market: ltv @81, offhours @87, price_e8 @89, price_time @97, session_open @105, max_age @106.
	const mk = new Map<string, { ltv: bigint; price: bigint; fresh: boolean }>()
	a.markets.forEach((m, i) => {
		const info = infos[i + 1]
		if (!info) return
		const d = b64decode(info.data[0])
		const open = d[105] === 1
		const ltv = u(d, 81, 2) - (open ? 0n : u(d, 87, 2))
		const fresh = nowS - Number(i64(d, 97)) <= Number(u(d, 106, 4))
		mk.set(m.market.toBase58(), { ltv, price: u(d, 89, 8), fresh })
	})

	const actions: Action[] = []
	for (const acc of positions) {
		// Position: market @40, kind @72, collateral @74, scaled_debt @82, shares @98, target @106.
		const d = b64decode(acc.account.data[0])
		const market = b58encode(d.slice(40, 72))
		const m = mk.get(market)
		if (!m || !m.fresh) continue // a previous deployment's market, or a stale price
		const kind = d[72]
		const value = (u(d, 74, 8) * m.price) / 10n ** 10n
		const debt = (u(d, 82, 16) * index + WAD - 1n) / WAD
		const target = u(d, 106, 2)
		const band = (value * BAND_BPS) / BPS
		const capped = target < m.ltv ? target : m.ltv
		if (kind === 0) {
			const buffer = (u(d, 98, 8) * nav) / WAD
			if (buffer > debt + debt / 1000n + minCompound) actions.push({ position: acc.pubkey, market, op: 'compound' })
			const wanted = (value * capped) / BPS
			const up = wanted > debt + band && wanted - debt >= minBorrow && cash > 0n
			const down = debt > wanted + band && buffer > 0n
			if (up || down) actions.push({ position: acc.pubkey, market, op: 'rebalance' })
		} else {
			const wanted = (value * target) / BPS
			const wantedUp = (value * capped) / BPS
			if ((wantedUp > debt + band && cash > 0n) || debt > wanted + band) actions.push({ position: acc.pubkey, market, op: 'rebalance' })
		}
	}
	actions.sort((x, y) => (x.position + x.op < y.position + y.op ? -1 : 1))
	return JSON.stringify({ blockhash, actions: actions.slice(0, config.maxActions) } satisfies Plan)
}

type Sent = { sent: number; landed: number; refused: number }

/** Step 3, per node: send the agreed, already signed bytes. */
const send = (req: HTTPSendRequester, config: Config, txs: string[]): Sent => {
	const out: Sent = { sent: txs.length, landed: 0, refused: 0 }
	for (const tx of txs) {
		const r = rpc(req, config.rpcUrl, 'sendTransaction', [tx, { encoding: 'base64', preflightCommitment: 'confirmed' }])
		if (r.result) out.landed++
		else out.refused++ // nothing to do after all, or another node's copy landed first
	}
	return out
}

const onCron = (runtime: Runtime<Config>) => {
	const config = runtime.config
	const nowS = Math.floor(runtime.now().getTime() / 1000)
	const http = new HTTPClient()

	const agreed: Plan = JSON.parse(http.sendRequest(runtime, plan, consensusIdenticalAggregation<string>())(config, nowS).result())
	if (agreed.actions.length === 0) {
		runtime.log('every position on target, nothing to send')
		return { sent: 0, landed: 0, refused: 0 }
	}

	// Step 2, DON mode: sign deterministically, so every node holds the same bytes.
	const signer = Keypair.fromSecretKey(b58decode(runtime.getSecret({ id: 'AGENT_KEY' }).result().value))
	const a = accounts(config)
	const byMarket = new Map(a.markets.map((m) => [m.market.toBase58(), m]))
	const txs = agreed.actions.map((act) => {
		const m = byMarket.get(act.market)!
		const ix = new TransactionInstruction({
			programId: a.program,
			data: Uint8Array.from(OPS[act.op]) as any,
			keys: [
				{ pubkey: signer.publicKey, isSigner: true, isWritable: false },
				{ pubkey: a.protocol, isSigner: false, isWritable: true },
				{ pubkey: m.market, isSigner: false, isWritable: true },
				{ pubkey: new PublicKey(act.position), isSigner: false, isWritable: true },
				{ pubkey: a.usdcMint, isSigner: false, isWritable: true },
				{ pubkey: m.stockMint, isSigner: false, isWritable: true },
				{ pubkey: a.poolUsdc, isSigner: false, isWritable: true },
				{ pubkey: a.vaultUsdc, isSigner: false, isWritable: true },
				{ pubkey: m.custody, isSigner: false, isWritable: true },
				{ pubkey: new PublicKey(TOKEN_2022), isSigner: false, isWritable: false },
			],
		})
		const tx = new Transaction({ feePayer: signer.publicKey, recentBlockhash: agreed.blockhash }).add(ix)
		tx.sign(signer)
		return b64encode(tx.serialize() as unknown as Uint8Array)
	})

	const sent = http
		.sendRequest(
			runtime,
			send,
			ConsensusAggregationByFields<Sent>({ sent: median<number>, landed: median<number>, refused: median<number> } as any),
		)(config, txs)
		.result()
	runtime.log(
		`${agreed.actions.map((x) => `${x.op} ${x.position.slice(0, 6)}`).join(', ')}: ${sent.landed} landed, ${sent.refused} refused by preflight`,
	)
	return sent
}

const initWorkflow = (config: Config) => [handler(new CronCapability().trigger({ schedule: config.schedule }), onCron)]

export async function main() {
	const runner = await Runner.newRunner<Config>({ configSchema })
	await runner.run(initWorkflow)
}

main()
