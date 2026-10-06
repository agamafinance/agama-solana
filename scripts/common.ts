// Shared wiring for the Agama-on-Solana scripts: PDAs, the program client, the
// four markets and where their prices come from.
import fs from "fs";
import os from "os";
import path from "path";
import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

export const RPC = process.env.SOLANA_RPC ?? "https://rpc.magicblock.app/devnet";
export const ROOT = path.join(__dirname, "..");
const idl = JSON.parse(fs.readFileSync(path.join(ROOT, "idl/agama_solana.json"), "utf8"));
export const PROGRAM_ID = new PublicKey(idl.address);

const seed = (s: string) => Buffer.from(s);
export const pda = (...seeds: Buffer[]) => PublicKey.findProgramAddressSync(seeds, PROGRAM_ID)[0];

export const protocolPda = pda(seed("protocol"));
export const usdcMint = pda(seed("usdc"));
export const lpMint = pda(seed("lp"));
export const poolUsdc = pda(seed("pool_usdc"));
export const vaultUsdc = pda(seed("vault_usdc"));

export function symbolBytes(sym: string): number[] {
  const b = Buffer.alloc(8);
  b.write(sym);
  return [...b];
}

/// The four markets, with the terms the X Layer build ships (a loop at L
/// carries an LTV of (L - 1) / L: 1.43x on TSLA and NVDA, 1.54x on AAPL, 2x
/// on SPY), and the mainnet xStock each one tracks.
export const MARKETS = [
  { symbol: "TSLA", ltv: 3000, lt: 4000, xstock: "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB" },
  { symbol: "NVDA", ltv: 3000, lt: 4000, xstock: "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh" },
  { symbol: "AAPL", ltv: 3500, lt: 4500, xstock: "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp" },
  { symbol: "SPY", ltv: 5000, lt: 6000, xstock: "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W" },
] as const;

export function marketAccounts(symbol: string) {
  const stockMint = pda(seed("stock"), Buffer.from(symbolBytes(symbol)));
  const market = pda(seed("market"), stockMint.toBuffer());
  const custody = pda(seed("custody"), market.toBuffer());
  return { stockMint, market, custody };
}

export function positionPda(owner: PublicKey, market: PublicKey, kind: "earn" | "amplify") {
  return pda(seed("position"), owner.toBuffer(), market.toBuffer(), seed(kind));
}

export const ata = (owner: PublicKey, mint: PublicKey) => getAssociatedTokenAddressSync(mint, owner);

export function loadKeypair(file?: string): Keypair {
  const f = file ?? process.env.ANCHOR_WALLET ?? path.join(os.homedir(), ".config/solana/id.json");
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(f, "utf8"))));
}

export const keeperKeypair = () => loadKeypair(path.join(ROOT, ".keys/keeper.json"));

export function connection(): Connection {
  return new Connection(RPC, "confirmed");
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

export async function fetchQuotes(): Promise<Quote[]> {
  const ids = MARKETS.map((m) => m.xstock).join(",");
  const res = await fetch(`https://lite-api.jup.ag/price/v3?ids=${ids}`);
  if (!res.ok) throw new Error(`jupiter price ${res.status}`);
  const body = (await res.json()) as Record<string, any>;
  const open = nyseOpen();
  const now = Math.floor(Date.now() / 1000);
  const out: Quote[] = [];
  for (const m of MARKETS) {
    const q = body[m.xstock];
    if (!q) continue;
    const share = q.stockData?.price as number | undefined;
    const shareTime = q.stockData?.updatedAt ? Math.floor(Date.parse(q.stockData.updatedAt) / 1000) : 0;
    const useShare = open && share && now - shareTime < 300;
    const price = useShare ? share! : (q.usdPrice as number);
    if (!price || !(price > 0)) continue;
    out.push({
      symbol: m.symbol,
      priceE8: BigInt(Math.round(price * 1e8)),
      publishTime: useShare ? Math.min(shareTime, now) : now,
      sessionOpen: !!useShare,
      source: useShare ? "share (NYSE session)" : "xStock token on Solana",
    });
  }
  return out;
}

export const fmtUsd = (x: bigint | number, decimals = 6) => (Number(x) / 10 ** decimals).toFixed(2);
