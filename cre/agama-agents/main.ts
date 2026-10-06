// agama-agents: Agama's permissionless agents, run by Chainlink CRE instead of
// a keeper.
//
// Every minute:
//   1. read every Agama position on chain (getProgramAccounts over HTTP)
//   2. for each one, build `compound` (Earn) and `rebalance` (both products),
//      sign with the agent key the workflow holds as a CRE secret, and send
//   3. the RPC's preflight simulates each one first: a position already on
//      target (AlreadyOnTarget) or with no yield to compound (NothingToCompound)
//      is refused before it costs anything, so the workflow can offer every
//      action and only the useful ones land
//
// Why not a signed report through the Keystone Forwarder, like the prices:
// an agent action needs ten accounts, and a CRE Solana write has no address
// lookup tables yet, so it leaves ~265 bytes once accounts are paid. The
// instructions are permissionless anyway: any signer may call them, and the
// program decides whether they do anything. The workflow is one such signer.
//
// Under the DON, each node sends its own signed copy: the first to land acts,
// the rest fail preflight (the position is on target by then). Rebalance and
// compound are idempotent in that sense.
import {
	ConsensusAggregationByFields,
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
})
type Config = z.infer<typeof configSchema>

const TOKEN_2022 = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
const POSITION_DISC = [170, 188, 143, 228, 122, 64, 247, 208]
const COMPOUND = [165, 208, 251, 78, 242, 160, 141, 47]
const REBALANCE = [108, 158, 77, 9, 210, 52, 88, 62]
const enc = (s: string) => new TextEncoder().encode(s)

// --- base58 / base64, no Buffer or Intl in the workflow runtime ------------

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

// --- JSON-RPC over the HTTP capability --------------------------------------

const rpc = (req: HTTPSendRequester, url: string, method: string, params: unknown[]): any => {
	const body = enc(JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }))
	const resp = req.sendRequest({ url, method: 'POST' as const, headers: { 'Content-Type': 'application/json' }, body }).result()
	if (resp.statusCode !== 200) throw new Error(`${method}: HTTP ${resp.statusCode}`)
	return JSON.parse(new TextDecoder().decode(resp.body))
}

type Outcome = { positions: number; acted: number; onTarget: number; failed: number }

/** What one node does: read, offer every action, count what landed. */
const runAgents = (req: HTTPSendRequester, config: Config, agentKey: string): Outcome => {
	const program = new PublicKey(config.programId)
	const pda = (...seeds: Uint8Array[]) => PublicKey.findProgramAddressSync(seeds, program)[0]
	const symbolBytes = (s: string) => {
		const b = new Uint8Array(8)
		b.set(enc(s))
		return b
	}
	const protocol = pda(enc('protocol.v2'))
	const usdcMint = pda(enc('usdc.v2'))
	const poolUsdc = pda(enc('pool_usdc.v2'))
	const vaultUsdc = pda(enc('vault_usdc.v2'))
	const markets = new Map<string, { market: PublicKey; stockMint: PublicKey; custody: PublicKey }>()
	for (const sym of config.markets) {
		const stockMint = pda(enc('stock.v2'), symbolBytes(sym))
		const market = pda(enc('market.v2'), stockMint.toBytes())
		markets.set(market.toBase58(), { market, stockMint, custody: pda(enc('custody.v2'), market.toBytes()) })
	}

	const signer = Keypair.fromSecretKey(b58decode(agentKey))
	const agent = signer.publicKey

	const accounts = rpc(req, config.rpcUrl, 'getProgramAccounts', [
		config.programId,
		{
			encoding: 'base64',
			commitment: 'confirmed', // a position opened seconds ago is not finalized yet
			dataSlice: { offset: 40, length: 33 }, // market (32) + kind (1)
			filters: [{ memcmp: { offset: 0, bytes: b58encode(Uint8Array.from(POSITION_DISC)) } }],
		},
	]).result as { pubkey: string; account: { data: [string, string] } }[]

	const out: Outcome = { positions: 0, acted: 0, onTarget: 0, failed: 0 }
	const blockhash = rpc(req, config.rpcUrl, 'getLatestBlockhash', [{ commitment: 'confirmed' }]).result.value.blockhash as string

	for (const a of accounts) {
		const data = b64decode(a.account.data[0])
		const m = markets.get(new PublicKey(data.slice(0, 32)).toBase58())
		if (!m) continue // a position of a previous deployment
		out.positions++
		const kind = data[32]
		const ops = kind === 0 ? [COMPOUND, REBALANCE] : [REBALANCE]
		for (const op of ops) {
			const ix = new TransactionInstruction({
				programId: program,
				data: Uint8Array.from(op) as any,
				keys: [
					{ pubkey: agent, isSigner: true, isWritable: false },
					{ pubkey: protocol, isSigner: false, isWritable: true },
					{ pubkey: m.market, isSigner: false, isWritable: true },
					{ pubkey: new PublicKey(a.pubkey), isSigner: false, isWritable: true },
					{ pubkey: usdcMint, isSigner: false, isWritable: true },
					{ pubkey: m.stockMint, isSigner: false, isWritable: true },
					{ pubkey: poolUsdc, isSigner: false, isWritable: true },
					{ pubkey: vaultUsdc, isSigner: false, isWritable: true },
					{ pubkey: m.custody, isSigner: false, isWritable: true },
					{ pubkey: new PublicKey(TOKEN_2022), isSigner: false, isWritable: false },
				],
			})
			const tx = new Transaction({ feePayer: agent, recentBlockhash: blockhash }).add(ix)
			tx.sign(signer)
			const sent = rpc(req, config.rpcUrl, 'sendTransaction', [
				b64encode(tx.serialize() as unknown as Uint8Array),
				{ encoding: 'base64', preflightCommitment: 'confirmed' },
			])
			if (sent.result) out.acted++
			else if (JSON.stringify(sent.error ?? '').match(/AlreadyOnTarget|NothingToCompound|NothingToDeleverage|0x177e|0x177f|0x1780/)) out.onTarget++
			else out.failed++
		}
	}
	return out
}

const onCron = (runtime: Runtime<Config>) => {
	const agentKey = runtime.getSecret({ id: 'AGENT_KEY' }).result().value
	const outcome = new HTTPClient()
		.sendRequest(
			runtime,
			runAgents,
			ConsensusAggregationByFields<Outcome>({ positions: median<number>, acted: median<number>, onTarget: median<number>, failed: median<number> } as any),
		)(runtime.config, agentKey)
		.result()
	runtime.log(`positions ${outcome.positions}: ${outcome.acted} acted, ${outcome.onTarget} already on target, ${outcome.failed} failed`)
	return outcome
}

const initWorkflow = (config: Config) => [handler(new CronCapability().trigger({ schedule: config.schedule }), onCron)]

export async function main() {
	const runner = await Runner.newRunner<Config>({ configSchema })
	await runner.run(initWorkflow)
}

main()
