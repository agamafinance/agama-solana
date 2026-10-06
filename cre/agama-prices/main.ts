// agama-prices: the price layer of Agama on Solana, as a Chainlink CRE workflow.
//
// Every minute, each node of the DON reads the same public sources:
//   - Chainlink Data Streams (RWA Advanced v11): each share's regular,
//     extended and overnight stream; marketStatus picks the live one. The
//     primary price whenever a session is live
//   - Jupiter's price API for the xStocks on Solana mainnet: the token's own
//     24/7 price and the underlying share's last price
//   - DexScreener, the deepest USDC pair of each xStock (Raydium, Meteora...):
//     a second, independent price for the token. If the two disagree by more
//     than 2%, the market is skipped this run rather than priced off one
//   - Orca's GLDY/USDC whirlpool (Streamex's gold-backed token, ~1 oz each)
//     and the gold spot price, as a guard on a thin pool
// The DON agrees on the median of every field, decides on its own clock whether
// each market is in session, and writes signed reports to the Agama program's
// `on_report` through the Keystone Forwarder, three markets per report (a
// Solana write leaves ~265 bytes before its accounts), one group per run.
//
// The program applies the same bounds whoever brings a price: publish time
// only forward, at most 15% per update, and borrowing waits on a stale one.
import {
	ConsensusAggregationByFields,
	CronCapability,
	getNetwork,
	handler,
	HTTPClient,
	type HTTPSendRequester,
	median,
	Runner,
	type Runtime,
	type SolanaAccountMeta,
	SolanaClient,
	SolanaTxStatus,
	solanaAccountMeta,
} from '@chainlink/cre-sdk'
import { getBase58Decoder } from '@solana/codecs'
import { PublicKey } from '@solana/web3.js'
import { z } from 'zod'
import { hmac } from '@noble/hashes/hmac'
import { sha256 } from '@noble/hashes/sha256'
import { bytesToHex } from '@noble/hashes/utils'
import { AgamaSolana, type PriceUpdate } from '../contracts/solana/ts/generated'

const BASE58 = getBase58Decoder()
const enc = (s: string) => new TextEncoder().encode(s)

const streams = z.object({ regular: z.string(), extended: z.string(), overnight: z.string() })
const xstock = z.object({ symbol: z.string().max(8), kind: z.literal('xstock'), mint: z.string(), streams: streams.optional() })
const gold = z.object({
	symbol: z.string().max(8),
	kind: z.literal('gold'),
	orcaPool: z.string(),
	// Data Streams XAU/USDT and USDT/USD: the gold reference once the credentials cover them.
	streams: z.object({ xau: z.string(), usdt: z.string() }).optional(),
})

const configSchema = z.object({
	schedule: z.string(),
	/** Chainlink Data Streams REST API (RWA Advanced v11 reports for the shares). */
	dataStreamsUrl: z.string(),
	jupiterUrl: z.string(),
	/** Second, independent source for the xStock tokens: DEX pairs (Raydium, Meteora...). */
	dexscreenerUrl: z.string(),
	/** Two token sources further apart than this and the market is skipped this run. */
	sourceMaxDeviationBps: z.number(),
	/** Mainnet RPCs, tried in order: the GLDY price is read straight from Orca's whirlpool account. */
	mainnetRpcs: z.array(z.string()).min(1),
	goldSpotUrl: z.string(),
	/** Orca pool price is taken while within this many bps of spot. */
	goldMaxDeviationBps: z.number(),
	/** A share price older than this (seconds) is not "in session". */
	shareMaxAge: z.number(),
	marketsPerReport: z.number(),
	solana: z.object({
		chainSelectorName: z.string(),
		receiverProgramId: z.string(),
		forwarderProgramId: z.string(),
		forwarderState: z.string(),
	}),
	markets: z.array(z.discriminatedUnion('kind', [xstock, gold])),
})
type Config = z.infer<typeof configSchema>

// ---------------------------------------------------------------------------
// Sessions, on the DON's clock (no Intl in the workflow runtime, so US DST is
// computed by hand: second Sunday of March to first Sunday of November).
// ---------------------------------------------------------------------------

function nthSunday(year: number, month: number, n: number): number {
	const first = new Date(Date.UTC(year, month, 1)).getUTCDay()
	return 1 + ((7 - first) % 7) + 7 * (n - 1)
}

/** New York wall clock for a UTC instant: [weekday 0=Sun, minutes since midnight]. */
function newYork(t: Date): [number, number] {
	const y = t.getUTCFullYear()
	const dstStart = Date.UTC(y, 2, nthSunday(y, 2, 2), 7) // 2am EST = 7am UTC
	const dstEnd = Date.UTC(y, 10, nthSunday(y, 10, 1), 6) // 2am EDT = 6am UTC
	const offset = t.getTime() >= dstStart && t.getTime() < dstEnd ? -4 : -5
	const local = new Date(t.getTime() + offset * 3600_000)
	return [local.getUTCDay(), local.getUTCHours() * 60 + local.getUTCMinutes()]
}

/** NYSE regular session, holidays aside. */
function nyseOpen(t: Date): boolean {
	const [day, min] = newYork(t)
	return day >= 1 && day <= 5 && min >= 9 * 60 + 30 && min < 16 * 60
}

/** Gold trades Sunday 6pm to Friday 5pm New York time. */
function goldOpen(t: Date): boolean {
	const [day, min] = newYork(t)
	if (day === 6) return false
	if (day === 0) return min >= 18 * 60
	if (day === 5) return min < 17 * 60
	return true
}

// ---------------------------------------------------------------------------
// What each node observes. Every field is a number so the DON can take the
// median field by field; 0 means "this node could not read it".
// ---------------------------------------------------------------------------

type Observation = Record<string, number>

const get = (req: HTTPSendRequester, url: string): any => {
	const resp = req.sendRequest({ url, method: 'GET' as const }).result()
	if (resp.statusCode !== 200) throw new Error(`${url} returned ${resp.statusCode}`)
	return JSON.parse(new TextDecoder().decode(resp.body))
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const fromBase64 = (s: string): Uint8Array => {
	const clean = s.replace(/=+$/, '')
	const out: number[] = []
	let buf = 0
	let bits = 0
	for (const ch of clean) {
		buf = (buf << 6) | B64.indexOf(ch)
		bits += 6
		if (bits >= 8) {
			bits -= 8
			out.push((buf >> bits) & 0xff)
		}
	}
	return Uint8Array.from(out)
}

/** Orca whirlpool sqrt_price (u128 LE at offset 65), read on chain. */
const whirlpoolSqrtPrice = (req: HTTPSendRequester, rpc: string, pool: string): bigint => {
	const body = JSON.stringify({
		jsonrpc: '2.0',
		id: 1,
		method: 'getAccountInfo',
		params: [pool, { encoding: 'base64', dataSlice: { offset: 65, length: 16 } }],
	})
	const resp = req
		.sendRequest({ url: rpc, method: 'POST' as const, headers: { 'Content-Type': 'application/json' }, body: new TextEncoder().encode(body) })
		.result()
	if (resp.statusCode !== 200) throw new Error(`rpc returned ${resp.statusCode}`)
	const bytes = fromBase64(JSON.parse(new TextDecoder().decode(resp.body)).result.value.data[0])
	let v = 0n
	for (let i = 15; i >= 0; i--) v = (v << 8n) | BigInt(bytes[i])
	return v
}

type DsCreds = { key: string; secret: string; nowMs: number }

/** fullReport = abi(bytes32[3] ctx, bytes blob, ...); blob = one 32-byte word
 *  per field. Word 6 is v11's mid and v3's benchmarkPrice (18 decimals), word 2
 *  the observation time, word 13 v11's marketStatus (absent from v3: 0). */
function decodeReport(hex: string): { mid: number; status: number; at: number } {
	const h = hex.replace(/^0x/, '')
	const word = (off: number, i: number) => BigInt('0x' + h.slice((off + i * 32) * 2, (off + i * 32 + 32) * 2))
	const lenOff = Number(word(0, 3))
	const words = Number(word(lenOff, 0)) / 32
	const blobOff = lenOff + 32
	const mid = BigInt.asIntN(256, word(blobOff, 6))
	return { mid: Number(mid / 10n ** 10n) / 1e8, status: words > 13 ? Number(word(blobOff, 13)) : 0, at: Number(word(blobOff, 2)) }
}

/** One signed bulk request to the Data Streams API (HMAC-SHA256 over method,
 *  path, body hash, key and time). Raw reports by feed ID; empty on any error
 *  (a feed the credentials do not cover makes the whole request 401). */
const dsBulk = (req: HTTPSendRequester, config: Config, ds: DsCreds, ids: string[]): Map<string, string> => {
	const path = `/api/v1/reports/bulk?feedIDs=${ids.join(',')}&timestamp=${Math.floor(ds.nowMs / 1000) - 2}`
	const toSign = `GET ${path} ${bytesToHex(sha256(new Uint8Array()))} ${ds.key} ${ds.nowMs}`
	const signature = bytesToHex(hmac(sha256, enc(ds.secret), enc(toSign)))
	const resp = req
		.sendRequest({
			url: config.dataStreamsUrl + path,
			method: 'GET' as const,
			headers: { Authorization: ds.key, 'X-Authorization-Timestamp': String(ds.nowMs), 'X-Authorization-Signature-SHA256': signature },
		})
		.result()
	const out = new Map<string, string>()
	if (resp.statusCode !== 200) return out
	for (const r of JSON.parse(new TextDecoder().decode(resp.body)).reports ?? []) out.set(String(r.feedID).toLowerCase(), r.fullReport)
	return out
}

const observe = (req: HTTPSendRequester, config: Config, ds: DsCreds): Observation => {
	const out: Observation = {}
	const xs = config.markets.filter((m) => m.kind === 'xstock')
	const golds = config.markets.filter((m) => m.kind === 'gold')
	for (const m of config.markets) {
		out[`${m.symbol}_a`] = 0
		out[`${m.symbol}_b`] = 0
		out[`${m.symbol}_t`] = 0
		out[`${m.symbol}_d`] = 0
		out[`${m.symbol}_g`] = 0 // gold spot publish time
		out[`${m.symbol}_s`] = 0 // Data Streams mid for the session that is live
		out[`${m.symbol}_ss`] = 0 // its market status (2 regular, 1 pre, 3 post, 4 overnight)
		out[`${m.symbol}_st`] = 0 // its observation time
	}
	// Chainlink Data Streams first: every share's regular, extended and
	// overnight stream in one signed request (HMAC-SHA256 over method, path,
	// body hash, key and time, as the API wants).
	const streamed = config.markets.flatMap((m) => (m.kind === 'xstock' && m.streams ? [m] : []))
	if (streamed.length && ds.key) {
		try {
			const ids = streamed.flatMap((m) => [m.streams!.regular, m.streams!.extended, m.streams!.overnight])
			const raw = dsBulk(req, config, ds, ids)
			const byId = new Map([...raw].map(([k, v]) => [k, decodeReport(v)]))
			for (const m of streamed) {
				const reg = byId.get(m.streams!.regular.toLowerCase())
				const ext = byId.get(m.streams!.extended.toLowerCase())
				const ovn = byId.get(m.streams!.overnight.toLowerCase())
				// marketStatus says which session is live; never the timestamps.
				const live = reg && reg.status === 2 ? reg : ext && (ext.status === 1 || ext.status === 3) ? ext : ovn && ovn.status === 4 ? ovn : undefined
				if (live && live.mid > 0) {
					out[`${m.symbol}_s`] = live.mid
					out[`${m.symbol}_ss`] = live.status
					out[`${m.symbol}_st`] = live.at
				}
			}
		} catch {}
	}
	// Each source on its own: one failing must not take the others down.
	if (xs.length) {
		try {
			const body = get(req, `${config.jupiterUrl}?ids=${xs.map((m) => m.mint).join(',')}`)
			for (const m of xs) {
				const q = body[m.mint]
				if (!q) continue
				out[`${m.symbol}_a`] = Number(q.usdPrice) || 0 // the token, 24/7
				out[`${m.symbol}_b`] = Number(q.stockData?.price) || 0 // the share
				out[`${m.symbol}_t`] = q.stockData?.updatedAt ? Math.floor(Date.parse(q.stockData.updatedAt) / 1000) : 0
			}
		} catch {}
	}
	if (xs.length) {
		try {
			// The deepest USDC pair per token, from DexScreener (no API key).
			const pairs = get(req, `${config.dexscreenerUrl}/${xs.map((m) => m.mint).join(',')}`) as any[]
			for (const m of xs) {
				let best = 0
				let liq = 0
				for (const p of pairs) {
					if (p.baseToken?.address !== m.mint || p.quoteToken?.symbol !== 'USDC') continue
					const l = Number(p.liquidity?.usd) || 0
					if (l > liq) {
						liq = l
						best = Number(p.priceUsd) || 0
					}
				}
				out[`${m.symbol}_d`] = best
			}
		} catch {}
	}
	const goldStreamed = config.markets.flatMap((m) => (m.kind === 'gold' && m.streams ? [m] : []))
	if (goldStreamed.length && ds.key) {
		try {
			const raw = dsBulk(req, config, ds, goldStreamed.flatMap((m) => [m.streams!.xau, m.streams!.usdt]))
			for (const m of goldStreamed) {
				const xau = raw.get(m.streams!.xau.toLowerCase())
				const usdt = raw.get(m.streams!.usdt.toLowerCase())
				if (!xau || !usdt) continue
				const x = decodeReport(xau)
				const u = decodeReport(usdt)
				if (x.mid > 0 && u.mid > 0) {
					out[`${m.symbol}_s`] = x.mid * u.mid
					out[`${m.symbol}_st`] = Math.min(x.at, u.at)
				}
			}
		} catch {}
	}
	if (golds.length) {
		let spot = 0
		let spotTime = 0
		try {
			const g = get(req, config.goldSpotUrl)
			spot = Number(g.price) || 0
			spotTime = g.updatedAt ? Math.floor(Date.parse(g.updatedAt) / 1000) : 0
		} catch {}
		for (const m of golds) {
			out[`${m.symbol}_b`] = spot // gold spot, per ounce
			out[`${m.symbol}_g`] = spotTime
			try {
				// tokenA = USDC (6 decimals), tokenB = GLDY (9): sqrt_price is Q64.64 of raw B per raw A.
				let raw = 0n
				for (const rpc of config.mainnetRpcs) {
					try {
						raw = whirlpoolSqrtPrice(req, rpc, m.orcaPool)
						break
					} catch {}
				}
				const sqrt = Number(raw) / 2 ** 64
				const gldyPerUsdc = sqrt * sqrt * 10 ** (6 - 9)
				out[`${m.symbol}_a`] = gldyPerUsdc > 0 ? 1 / gldyPerUsdc : 0
			} catch {}
		}
	}
	for (const m of config.markets) for (const k of ['a', 'b', 'd', 's']) out[`${m.symbol}_${k}_ok`] = out[`${m.symbol}_${k}`] > 0 ? 1 : 0
	return out
}

// ---------------------------------------------------------------------------
// The DON's decision, from the agreed observation.
// ---------------------------------------------------------------------------

type Decision = { symbol: string; price: number; open: boolean; source: string; at: number }

function decide(config: Config, obs: Observation, now: Date, skipped: string[]): Decision[] {
	const nowS = Math.floor(now.getTime() / 1000)
	const out: Decision[] = []
	// A source counts only if a majority of nodes read it: a node that could
	// not read a source reports 0, and those zeros must not drag a median.
	const seen = (k: string) => (obs[`${k}_ok`] ?? 0) > 0.5
	for (const m of config.markets) {
		const a = seen(`${m.symbol}_a`) ? obs[`${m.symbol}_a`] : 0
		const b = seen(`${m.symbol}_b`) ? obs[`${m.symbol}_b`] : 0
		if (m.kind === 'xstock') {
			// The token's price from two independent sources: Jupiter and the
			// deepest DEX pair. Apart by more than the band, nobody is trusted
			// this run and the market keeps its last price.
			const d = seen(`${m.symbol}_d`) ? obs[`${m.symbol}_d`] : 0
			let token = 0
			let tokenSource = ''
			if (a > 0 && d > 0) {
				if (Math.abs(a / d - 1) * 10_000 > config.sourceMaxDeviationBps) {
					skipped.push(`${m.symbol}: Jupiter ${a.toFixed(2)} vs DEX ${d.toFixed(2)}`)
					continue
				}
				token = (a + d) / 2
				tokenSource = 'Jupiter + DEX'
			} else if (a > 0 || d > 0) {
				token = a > 0 ? a : d
				tokenSource = a > 0 ? 'Jupiter only' : 'DEX only'
			} else continue
			// Chainlink Data Streams lead whenever a session (regular, pre, post,
			// overnight) is live and the token agrees with them; regular hours
			// get the session terms, the extended sessions the off-hours ones.
			const sp = seen(`${m.symbol}_s`) ? obs[`${m.symbol}_s`] : 0
			const status = Math.round(obs[`${m.symbol}_ss`] ?? 0)
			if (sp > 0 && Math.abs(sp / token - 1) * 10_000 <= (3 * config.sourceMaxDeviationBps) / 2) {
				const label = ['', 'pre-market', 'regular', 'post-market', 'overnight'][status] ?? 'session'
				out.push({ symbol: m.symbol, price: sp, open: status === 2, source: `Data Streams ${label}, token ${tokenSource}`, at: Math.min(nowS, Math.round(obs[`${m.symbol}_st`])) })
				continue
			}
			if (sp > 0) skipped.push(`${m.symbol}: Data Streams ${sp.toFixed(2)} vs token ${token.toFixed(2)}, falling back`)
			const shareFresh = b > 0 && nowS - obs[`${m.symbol}_t`] < config.shareMaxAge
			// In session the share price leads, as long as the token agrees with it.
			const shareAgrees = shareFresh && Math.abs(b / token - 1) * 10_000 <= 3 * config.sourceMaxDeviationBps / 2
			// Stamped with the source's own time: a share price is as old as its
			// last print, the token trades now.
			if (nyseOpen(now) && shareAgrees)
				out.push({ symbol: m.symbol, price: b, open: true, source: `share, token ${tokenSource}`, at: Math.min(nowS, obs[`${m.symbol}_t`]) })
			else out.push({ symbol: m.symbol, price: token, open: false, source: `token, ${tokenSource}`, at: nowS })
		} else {
			const open = goldOpen(now)
			// The gold reference: Data Streams XAU/USD when available, else gold spot.
			const sp = seen(`${m.symbol}_s`) ? obs[`${m.symbol}_s`] : 0
			if (sp > 0) {
				const ok = a > 0 && Math.abs(a / sp - 1) * 10_000 <= config.goldMaxDeviationBps
				out.push({ symbol: m.symbol, price: ok ? a : sp, open, source: ok ? 'Orca pool, Data Streams XAU' : 'Data Streams XAU/USD', at: ok ? nowS : Math.min(nowS, Math.round(obs[`${m.symbol}_st`])) })
				continue
			}
			const near = a > 0 && b > 0 && Math.abs(a / b - 1) * 10_000 <= config.goldMaxDeviationBps
			const spotAt = obs[`${m.symbol}_g`] > 0 ? Math.min(nowS, obs[`${m.symbol}_g`]) : nowS
			if (near) out.push({ symbol: m.symbol, price: a, open, source: 'Orca pool', at: nowS })
			else if (b > 0 && nowS - spotAt < config.shareMaxAge) out.push({ symbol: m.symbol, price: b, open, source: 'gold spot', at: spotAt })
		}
	}
	return out
}

// ---------------------------------------------------------------------------

const pda = (seeds: Uint8Array[], program: string) => PublicKey.findProgramAddressSync(seeds, new PublicKey(program))[0]

const symbolBytes = (s: string) => {
	const b = new Uint8Array(8)
	b.set(enc(s))
	return b
}

const onCron = (runtime: Runtime<Config>) => {
	const config = runtime.config
	const sol = config.solana
	const now = runtime.now()

	const fields = Object.fromEntries(
		config.markets.flatMap((m) =>
			['a', 'b', 't', 'd', 'g', 's', 'ss', 'st', 'a_ok', 'b_ok', 'd_ok', 's_ok'].map((k) => [`${m.symbol}_${k}`, median<number>]),
		),
	)
	let obs: Observation
	try {
		const agg = ConsensusAggregationByFields<Observation>(fields as any)
		// Secrets are read in DON mode and handed to the node-mode fetch.
		const key = runtime.getSecret({ id: 'DATASTREAMS_API_KEY' }).result().value
		const secret = runtime.getSecret({ id: 'DATASTREAMS_API_SECRET' }).result().value
		const call = new HTTPClient().sendRequest(runtime, observe, agg)
		obs = call(config, { key, secret, nowMs: now.getTime() }).result()
	} catch (e: any) {
		runtime.log(`observe failed: ${e?.message} ${String(e?.stack ?? '').slice(0, 600)}`)
		throw e
	}

	const skipped: string[] = []
	const decided = decide(config, obs, now, skipped)
	for (const s of skipped) runtime.log(`skipped, sources disagree: ${s}`)
	for (const d of decided) runtime.log(`${d.symbol.padEnd(5)} ${d.price.toFixed(2)} ${d.open ? 'in session' : 'off hours'} (${d.source})`)

	const network = getNetwork({ chainFamily: 'solana', chainSelectorName: sol.chainSelectorName, isTestnet: true })
	if (!network) throw new Error(`unknown network ${sol.chainSelectorName}`)
	const agama = new AgamaSolana(new SolanaClient(network.chainSelector.selector), sol.receiverProgramId)

	const authority = pda([enc('forwarder'), new PublicKey(sol.forwarderState).toBytes(), new PublicKey(sol.receiverProgramId).toBytes()], sol.forwarderProgramId)
	const cre = pda([enc('cre.v3')], sol.receiverProgramId)
	const SYSVAR_INSTRUCTIONS = 'Sysvar1nstructions1111111111111111111111111'
	const market = (symbol: string) =>
		pda([enc('market.v2'), pda([enc('stock.v2'), symbolBytes(symbol)], sol.receiverProgramId).toBytes()], sol.receiverProgramId)

	// A Solana write leaves the receiver 265 bytes, less 32 per account it
	// lists (cre, the instructions sysvar, the markets); a price update is 25.
	const n = config.marketsPerReport
	if (4 + 25 * n > 265 - 32 * (2 + n) - (2 + n)) throw new Error(`marketsPerReport ${n} does not fit a Solana report`)
	const sigs: string[] = []

	// One report per run, the groups taking turns (minute by minute, the same
	// on every node). Several writes in one run hit the public devnet RPC's
	// connection limit while the simulator polls the first one's confirmation;
	// with 3 markets per report and 10 markets, each is refreshed every 4 min,
	// well inside the 10 min the program allows.
	const groups = Math.ceil(decided.length / n)
	const turn = Math.floor(now.getTime() / 60_000) % Math.max(groups, 1)
	for (let i = turn * n; i < Math.min(decided.length, (turn + 1) * n); i += n) {
		const group = decided.slice(i, i + n)
		const updates: PriceUpdate[] = group.map((d) => ({
			symbol: Array.from(symbolBytes(d.symbol)),
			priceE8: BigInt(Math.round(d.price * 1e8)),
			publishTime: BigInt(d.at),
			sessionOpen: d.open,
		}))
		const accounts: SolanaAccountMeta[] = [
			solanaAccountMeta(sol.forwarderState, true),
			solanaAccountMeta(authority.toBase58()),
			solanaAccountMeta(cre.toBase58(), true),
			solanaAccountMeta(SYSVAR_INSTRUCTIONS),
			...group.map((d) => solanaAccountMeta(market(d.symbol).toBase58(), true)),
		]
		const resp = agama.writeReportFromPriceReport(runtime, { updates }, accounts, { computeLimit: 200_000 })
		if (resp.txStatus !== SolanaTxStatus.SUCCESS) {
			runtime.log(`report ${group.map((d) => d.symbol).join(',')} failed: ${resp.errorMessage || resp.txStatus}`)
			continue
		}
		const sig = resp.txSignature ? BASE58.decode(resp.txSignature) : '(dry run)'
		sigs.push(sig)
		runtime.log(`report ${group.map((d) => d.symbol).join(',')} -> ${sig}`)
	}
	return { markets: decided.length, reports: sigs }
}

const initWorkflow = (config: Config) => [handler(new CronCapability().trigger({ schedule: config.schedule }), onCron)]

export async function main() {
	const runner = await Runner.newRunner<Config>({ configSchema })
	await runner.run(initWorkflow)
}

main()
