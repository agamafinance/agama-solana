// Prices from Chainlink Data Streams, verified on chain. The program's
// `push_report` takes the signed reports themselves and has Chainlink's
// Verifier check the DON's signatures, so whoever sends them (the keeper, or
// anyone) brings a price but cannot choose it.
//
//   a share  the report of the live session's feed, as the reports' own
//            marketStatus says: regular (and closed: the last close),
//            pre/post-market, overnight
//   gold     XAU/USDT and USDT/USD, multiplied on chain
import { BN, Program } from "@coral-xyz/anchor";
import { ComputeBudgetProgram, PublicKey, TransactionInstruction } from "@solana/web3.js";
// @ts-ignore no types
import SnappyJS from "snappyjs";
import { ACCESS_CONTROLLER, MARKETS, VERIFIER, VERIFIER_ACCOUNT, marketAccounts, pda, seed } from "./common";
import { FEEDS, Report, latestReports } from "./datastreams";

export const KIND_SESSIONS = 0;
export const KIND_CROSS = 1;

const STATUS_PRE = 1, STATUS_REGULAR = 2, STATUS_POST = 3, STATUS_OVERNIGHT = 4, STATUS_CLOSED = 5;

export type Quote = {
  symbol: string;
  /** What the program will compute from the reports, for logs and "has it moved". */
  priceE8: bigint;
  publishTime: number;
  sessionOpen: boolean;
  source: string;
  reports: Report[];
};

export const feedsPda = (market: PublicKey) => pda(seed("feeds"), market.toBuffer());

const id = (hex: string) => [...Buffer.from(hex.replace(/^0x/, ""), "hex")];

/** A market's feeds as `set_feeds` takes them. */
export function feedConfig(symbol: string): { kind: number; ids: number[][] } {
  const f = FEEDS[symbol];
  if (!f) throw new Error(`no Data Streams feeds for ${symbol}`);
  if (f.xau) return { kind: KIND_CROSS, ids: [id(f.xau), id(f.usdt), new Array(32).fill(0)] };
  return { kind: KIND_SESSIONS, ids: [id(f.regular), id(f.extended), id(f.overnight)] };
}

/** The latest verifiable price of every market, or none for a market whose session has no live feed. */
export async function latestQuotes(): Promise<Quote[]> {
  const byId = await latestReports(Object.values(FEEDS).flatMap((f) => Object.values(f)));
  const get = (hex?: string) => (hex ? byId.get(hex.toLowerCase()) : undefined);
  const out: Quote[] = [];
  for (const m of MARKETS) {
    const f = FEEDS[m.symbol] ?? {};
    if (f.xau) {
      const x = get(f.xau), u = get(f.usdt);
      if (!x || !u) continue;
      out.push({
        symbol: m.symbol,
        priceE8: (BigInt(Math.round(x.mid * 1e8)) * BigInt(Math.round(u.mid * 1e8))) / 100_000_000n,
        publishTime: Math.min(x.observedAt, u.observedAt),
        sessionOpen: false,
        source: "Data Streams XAU/USDT x USDT/USD",
        reports: [x, u],
      });
      continue;
    }
    const reg = get(f.regular);
    const status = reg?.marketStatus ?? 0;
    const r =
      status === STATUS_REGULAR || status === STATUS_CLOSED ? reg
      : status === STATUS_PRE || status === STATUS_POST ? get(f.extended)
      : status === STATUS_OVERNIGHT ? get(f.overnight)
      : undefined;
    if (!r) continue;
    const label = ["", "pre-market", "regular", "post-market", "overnight", "closed"][status];
    out.push({
      symbol: m.symbol,
      priceE8: BigInt(Math.round(r.mid * 1e8)),
      publishTime: r.observedAt,
      sessionOpen: status === STATUS_REGULAR,
      source: `Data Streams ${label}`,
      reports: [r],
    });
  }
  return out;
}

/** `push_report` for one market: the signed reports, snappy compressed as the Verifier takes them. */
export async function pushReportIxs(program: Program, payer: PublicKey, q: Quote): Promise<TransactionInstruction[]> {
  const { market } = marketAccounts(q.symbol);
  const raw = q.reports.map((r) => Buffer.from(r.full, "hex"));
  const ix = await program.methods
    .pushReport(raw.map((b) => Buffer.from(SnappyJS.compress(new Uint8Array(b)))))
    .accountsPartial({
      payer,
      market,
      feeds: feedsPda(market),
      verifierProgram: VERIFIER,
      verifierAccount: VERIFIER_ACCOUNT,
      accessController: ACCESS_CONTROLLER,
    })
    .remainingAccounts(raw.map((b) => ({ pubkey: PublicKey.findProgramAddressSync([b.subarray(0, 32)], VERIFIER)[0], isSigner: false, isWritable: false })))
    .instruction();
  return [ComputeBudgetProgram.setComputeUnitLimit({ units: 100_000 + 90_000 * raw.length }), ix];
}

export { BN };
