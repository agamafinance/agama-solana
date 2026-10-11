// Shared wiring for the Agama-on-Solana scripts: PDAs, the program client, the
// four markets and where their prices come from.
import fs from "fs";
import os from "os";
import path from "path";
import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { FEEDS, latestReports } from "./datastreams";

/// RPCs in order of preference (SOLANA_RPCS, comma separated, or SOLANA_RPC):
/// every call fails over to the next one on a rate limit, a 5xx, a timeout or a
/// dead endpoint, and the one that failed sits out for 30 s.
export const RPCS = (process.env.SOLANA_RPCS ?? process.env.SOLANA_RPC ?? "https://rpc.magicblock.app/devnet")
  .split(",")
  .map((u) => u.trim())
  .filter(Boolean);
export const RPC = RPCS[0];
const benched = new Map<string, number>();
async function failoverFetch(_input: any, init?: any): Promise<Response> {
  const now = Date.now();
  const order = [...RPCS.filter((u) => (benched.get(u) ?? 0) <= now), ...RPCS.filter((u) => (benched.get(u) ?? 0) > now)];
  let last: Response | undefined;
  let error: unknown;
  for (const url of order) {
    try {
      const r = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
      const text = await r.clone().text();
      if (r.status !== 429 && r.status < 500 && !/"code":\s*(429|-32029|-32005)\b/.test(text)) return r;
      last = r;
    } catch (e) {
      error = e;
    }
    benched.set(url, Date.now() + 30_000);
  }
  if (last) return last;
  throw error;
}
export const ROOT = path.join(__dirname, "..");
const idl = JSON.parse(fs.readFileSync(path.join(ROOT, "idl/agama_solana.json"), "utf8"));
export const PROGRAM_ID = new PublicKey(idl.address);

const seed = (s: string) => Buffer.from(s);
export const pda = (...seeds: Buffer[]) => PublicKey.findProgramAddressSync(seeds, PROGRAM_ID)[0];

export const protocolPda = pda(seed("protocol.v2"));
export const usdcMint = pda(seed("usdc.v2"));
export const lpMint = pda(seed("lp.v2"));
export const poolUsdc = pda(seed("pool_usdc.v2"));
export const vaultUsdc = pda(seed("vault_usdc.v2"));

export function symbolBytes(sym: string): number[] {
  const b = Buffer.alloc(8);
  b.write(sym);
  return [...b];
}

/// The markets. xStocks keep the X Layer terms (a loop at L carries an LTV of
/// (L - 1) / L: 1.43x on TSLA and NVDA, 1.54x on AAPL, 2x on SPY and QQQ) and
/// track their mainnet xStock. XAU tracks XAUt0 (Tether Gold on Solana, one
/// ounce per token): gold moves less, so it lends at 60%.
export const MARKETS = [
  { symbol: "TSLA", ltv: 3000, lt: 4000, kind: "xstock", xstock: "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB" },
  { symbol: "NVDA", ltv: 3000, lt: 4000, kind: "xstock", xstock: "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh" },
  { symbol: "AAPL", ltv: 3500, lt: 4500, kind: "xstock", xstock: "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp" },
  { symbol: "SPY", ltv: 5000, lt: 6000, kind: "xstock", xstock: "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W" },
  { symbol: "QQQ", ltv: 5000, lt: 6000, kind: "xstock", xstock: "Xs8S1uUs1zvS2p7iwtsG3b6fkhpvmwz4GYU3gWAmWHZ" },
  { symbol: "GOOGL", ltv: 3500, lt: 4500, kind: "xstock", xstock: "XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN" },
  { symbol: "MSFT", ltv: 3500, lt: 4500, kind: "xstock", xstock: "XspzcW1PRtgf6Wj92HCiZdjzKCyFekVD8P5Ueh3dRMX" },
  { symbol: "AMZN", ltv: 3500, lt: 4500, kind: "xstock", xstock: "Xs3eBt7uRfJX8QUs4suhyU8p2M6DoUDrJyWBa8LLZsg" },
  { symbol: "META", ltv: 3000, lt: 4000, kind: "xstock", xstock: "Xsa62P5mvPszXL1krVUnU5ar38bBSVcWAB6fmPCo5Zu" },
  { symbol: "XAU", ltv: 6000, lt: 7000, kind: "gold", xstock: "AymATz4TCL9sWNEEV9Kvyz45CHVhDZ6kUgjTJPzLpU9P" },
] as const;

export function marketAccounts(symbol: string) {
  const stockMint = pda(seed("stock.v2"), Buffer.from(symbolBytes(symbol)));
  const market = pda(seed("market.v2"), stockMint.toBuffer());
  const custody = pda(seed("custody.v2"), market.toBuffer());
  return { stockMint, market, custody };
}

export function positionPda(owner: PublicKey, market: PublicKey, kind: "earn" | "amplify") {
  return pda(seed("position.v2"), owner.toBuffer(), market.toBuffer(), seed(kind));
}

/// Every Agama mint is Token-2022 (confidential transfer extension).
export const TOKEN_PROGRAM = TOKEN_2022_PROGRAM_ID;
export const ata = (owner: PublicKey, mint: PublicKey) =>
  getAssociatedTokenAddressSync(mint, owner, true, TOKEN_2022_PROGRAM_ID);

export function loadKeypair(file?: string): Keypair {
  const f = file ?? process.env.ANCHOR_WALLET ?? path.join(os.homedir(), ".config/solana/id.json");
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(f, "utf8"))));
}

export const keeperKeypair = () => loadKeypair(path.join(ROOT, ".keys/keeper.json"));

export function connection(): Connection {
  return new Connection(RPC, { commitment: "confirmed", fetch: failoverFetch as any, disableRetryOnRateLimit: true });
}

export function programFor(wallet: Keypair, conn = connection()): anchor.Program {
  const provider = new anchor.AnchorProvider(conn, new anchor.Wallet(wallet), {
    commitment: "confirmed",
  });
  return new anchor.Program(idl, provider);
}

/// Accounts every money-moving instruction takes, for one market.
export function rails(symbol: string) {
  const m = marketAccounts(symbol);
  return {
    protocol: protocolPda,
    market: m.market,
    usdcMint,
    stockMint: m.stockMint,
    poolUsdc,
    vaultUsdc,
    custody: m.custody,
  };
}

// ---------------------------------------------------------------------------
// Prices
// ---------------------------------------------------------------------------
//
// The xStocks trade on Solana mainnet around the clock. Jupiter's price API
// returns both the token's own price and the underlying share's last price.
// While NYSE trades we relay the share; outside it, the token, flagged
// `session_open = false` so the program tightens the terms by the off-hours
// buffer. Pyth's public Hermes now wants an API key, so it is not the default.

export function nyseOpen(at = new Date()): boolean {
  const ny = new Date(at.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const day = ny.getDay();
  if (day === 0 || day === 6) return false;
  const minutes = ny.getHours() * 60 + ny.getMinutes();
  return minutes >= 9 * 60 + 30 && minutes < 16 * 60;
}

export type Quote = { symbol: string; priceE8: bigint; publishTime: number; sessionOpen: boolean; source: string };

/// Two sources must agree within this band to be trusted (bps).
const SOURCE_BAND_BPS = 200;
/// Gold's references (Data Streams, gold spot, XAUt0) within this band (bps).
const GOLD_BAND_BPS = 300;
/// A Data Streams report or a share print older than this is not a price (s).
const MAX_AGE_S = 120;

const near = (x: number, y: number, bps: number) => x > 0 && y > 0 && Math.abs(x / y - 1) * 10_000 <= bps;

/** Each source on its own: one failing must not take the others down. */
async function settle<T>(p: Promise<T>, fallback: T, what: string): Promise<T> {
  try {
    return await p;
  } catch (e: any) {
    console.log(new Date().toISOString(), `${what} unavailable: ${e.message?.split("\n")[0] ?? e}`);
    return fallback;
  }
}

const json = async (url: string) => {
  const r = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!r.ok) throw new Error(`${url.split("?")[0]} ${r.status}`);
  return r.json();
};

/// Gold trades Sunday 18:00 to Friday 17:00, New York time.
function goldOpen(at = new Date()): boolean {
  const ny = new Date(at.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const d = ny.getDay(), min = ny.getHours() * 60 + ny.getMinutes();
  return d === 6 ? false : d === 0 ? min >= 18 * 60 : d === 5 ? min < 17 * 60 : true;
}

/// The price of every market, from Chainlink Data Streams checked against the
/// tokens themselves:
///   shares  the Data Streams feed of the live session (regular, pre/post,
///           overnight, as its marketStatus says) leads when the token agrees;
///           else the share print while NYSE trades; else the token. The token
///           is Jupiter and the deepest DEX pair averaged, and when those two
///           disagree the market keeps its last price.
///   gold    Data Streams XAU/USDT x USDT/USD, when gold spot and XAUt0 agree
///           with it; else XAUt0 guarded by gold spot; else gold spot.
export async function fetchQuotes(): Promise<Quote[]> {
  const mints = MARKETS.map((m) => m.xstock);
  const ids = Object.values(FEEDS).flatMap((f) => Object.values(f));
  const [jup, dexPairs, streams, spotBody] = await Promise.all([
    settle(json(`https://lite-api.jup.ag/price/v3?ids=${mints.join(",")}`), {} as Record<string, any>, "Jupiter"),
    settle(json(`https://api.dexscreener.com/tokens/v1/solana/${mints.join(",")}`), [] as any[], "DexScreener"),
    settle(latestReports(ids), new Map(), "Data Streams"),
    settle(json("https://api.gold-api.com/price/XAU"), {} as any, "gold spot"),
  ]);
  const now = Math.floor(Date.now() / 1000);
  const fresh = (r?: { observedAt: number; expiresAt: number }) => !!r && now - r.observedAt <= MAX_AGE_S && r.expiresAt >= now;
  const stream = (id?: string) => (id ? streams.get(id.toLowerCase()) : undefined);
  // The deepest pair per token: USDC when there is one, else any pair priced in USD.
  const dex = (mint: string) => {
    let best = 0, liq = 0, usdc = false;
    for (const p of dexPairs) {
      if (p.baseToken?.address !== mint) continue;
      const isUsdc = p.quoteToken?.symbol === "USDC";
      const l = Number(p.liquidity?.usd) || 0;
      if ((isUsdc && !usdc) || (isUsdc === usdc && l > liq)) {
        best = Number(p.priceUsd) || 0;
        liq = l;
        usdc = isUsdc;
      }
    }
    return best;
  };
  const token = (mint: string): { price: number; source: string } | undefined => {
    const a = Number(jup[mint]?.usdPrice) || 0;
    const d = dex(mint);
    if (a > 0 && d > 0) return near(a, d, SOURCE_BAND_BPS) ? { price: (a + d) / 2, source: "Jupiter + DEX" } : undefined;
    if (a > 0) return { price: a, source: "Jupiter only" };
    if (d > 0) return { price: d, source: "DEX only" };
    return undefined;
  };
  const skip = (msg: string) => console.log(new Date().toISOString(), `skip ${msg}`);
  const out: Quote[] = [];
  const push = (symbol: string, price: number, publishTime: number, sessionOpen: boolean, source: string) =>
    out.push({ symbol, priceE8: BigInt(Math.round(price * 1e8)), publishTime: Math.min(publishTime, now), sessionOpen, source });

  for (const m of MARKETS) {
    const t = token(m.xstock);
    const f = FEEDS[m.symbol] ?? {};
    if (m.kind === "xstock") {
      if (!t) {
        skip(`${m.symbol}: no token price, or Jupiter and DEX disagree`);
        continue;
      }
      const reg = stream(f.regular), ext = stream(f.extended), ovn = stream(f.overnight);
      // marketStatus says which session is live; never the timestamps.
      const live = reg?.marketStatus === 2 ? reg : ext && (ext.marketStatus === 1 || ext.marketStatus === 3) ? ext : ovn?.marketStatus === 4 ? ovn : undefined;
      if (live && fresh(live) && live.mid > 0) {
        if (near(live.mid, t.price, (3 * SOURCE_BAND_BPS) / 2)) {
          const label = ["", "pre-market", "regular", "post-market", "overnight"][live.marketStatus];
          push(m.symbol, live.mid, live.observedAt, live.marketStatus === 2, `Data Streams ${label}, token ${t.source}`);
          continue;
        }
        skip(`${m.symbol}: Data Streams ${live.mid.toFixed(2)} vs token ${t.price.toFixed(2)}, falling back`);
      }
      const q = jup[m.xstock];
      const share = Number(q?.stockData?.price) || 0;
      const shareAt = q?.stockData?.updatedAt ? Math.floor(Date.parse(q.stockData.updatedAt) / 1000) : 0;
      if (nyseOpen() && share > 0 && now - shareAt < MAX_AGE_S && near(share, t.price, (3 * SOURCE_BAND_BPS) / 2)) push(m.symbol, share, shareAt, true, `share, token ${t.source}`);
      else push(m.symbol, t.price, now, false, `token, ${t.source}`);
    } else {
      const open = goldOpen();
      const x = stream(f.xau), u = stream(f.usdt);
      const ds = x && u && fresh(x) && fresh(u) ? x.mid * u.mid : 0;
      const spot = Number(spotBody.price) || 0;
      if (ds > 0 && (spot <= 0 || near(ds, spot, GOLD_BAND_BPS))) {
        if (t && !near(t.price, ds, GOLD_BAND_BPS)) {
          skip(`${m.symbol}: XAUt0 ${t.price.toFixed(2)} vs Data Streams ${ds.toFixed(2)}`);
          continue;
        }
        push(m.symbol, ds, Math.min(x!.observedAt, u!.observedAt), open, t ? `Data Streams XAU/USD, XAUt0 ${t.source}` : "Data Streams XAU/USD");
        continue;
      }
      if (ds > 0) skip(`${m.symbol}: Data Streams ${ds.toFixed(2)} vs spot ${spot.toFixed(2)}, falling back`);
      if (t && near(t.price, spot, GOLD_BAND_BPS)) push(m.symbol, t.price, now, open, `XAUt0 ${t.source}, gold spot`);
      else if (spot > 0) push(m.symbol, spot, now, open, "gold spot");
    }
  }
  return out;
}

export const fmtUsd = (x: bigint | number, decimals = 6) => (Number(x) / 10 ** decimals).toFixed(2);

/// Sign, send, and see it confirmed. Devnet RPCs drop transactions under load,
/// so the same signed bytes are re-sent every 2 s until the blockhash expires,
/// then the transaction is signed again with a fresh one (at most three times).
export async function sendReliably(
  conn: Connection,
  ixs: TransactionInstruction[],
  signers: Keypair[],
): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
    const tx = new Transaction({ feePayer: signers[0].publicKey, blockhash, lastValidBlockHeight }).add(...ixs);
    tx.sign(...signers);
    const raw = tx.serialize();
    const sig = await conn.sendRawTransaction(raw, { preflightCommitment: "confirmed", maxRetries: 0 });
    for (;;) {
      await new Promise((r) => setTimeout(r, 2000));
      const st = (await conn.getSignatureStatuses([sig], { searchTransactionHistory: true })).value[0];
      if (st?.err) throw new Error(`${sig} failed: ${JSON.stringify(st.err)}`);
      if (st?.confirmationStatus === "confirmed" || st?.confirmationStatus === "finalized") return sig;
      if ((await conn.getBlockHeight("confirmed")) > lastValidBlockHeight) {
        // It may have landed between the two reads: look once more before
        // signing it again, or it would run twice.
        const again = (await conn.getSignatureStatuses([sig], { searchTransactionHistory: true })).value[0];
        if (again?.err) throw new Error(`${sig} failed: ${JSON.stringify(again.err)}`);
        if (again?.confirmationStatus) return sig;
        break;
      }
      await conn.sendRawTransaction(raw, { skipPreflight: true, maxRetries: 0 }).catch(() => {});
    }
  }
  throw new Error("not confirmed after three blockhashes");
}

/// Give a throwaway test wallet's unspent SOL back, so a test run costs fees
/// and rent rather than its funding.
export async function sweep(conn: Connection, from: Keypair, to: PublicKey): Promise<void> {
  const bal = await conn.getBalance(from.publicKey);
  const keep = 1_000_000;
  if (bal <= keep + 5000) return;
  await sendReliably(conn, [SystemProgram.transfer({ fromPubkey: from.publicKey, toPubkey: to, lamports: bal - keep - 5000 })], [from]).catch(() => {});
}
