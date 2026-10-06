// Shared wiring for the Agama-on-Solana scripts: PDAs, the program client, the
// four markets and where their prices come from.
import fs from "fs";
import os from "os";
import path from "path";
import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";

export const RPC = process.env.SOLANA_RPC ?? "https://rpc.magicblock.app/devnet";
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
/// track their mainnet xStock. GLDY is Streamex's gold-backed token (about one
/// ounce each, priced off Orca's GLDY/USDC pool): gold moves less, so it lends
/// at 60%.
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
  { symbol: "GLDY", ltv: 6000, lt: 7000, kind: "gold", orcaPool: "7z9ijqqafMPUuGKGRBq8BtC6AFzXX4PfKPy2ijbGmby3" },
] as const;

/// Chainlink CRE forwarders on devnet: the CLI's mock (what `cre workflow
/// simulate --broadcast` relays through, no signature check) and the live
/// Keystone Forwarder (DON signatures verified).
export const CRE_FORWARDERS = {
  simulation: { program: "7kuEAA3mSC1Tz8gQjnvH7bKFda9xSPRRin9SZbH49cNK", state: "5Tipz3yhTBdVsDbaBxZkrp7Gjf3brGq5SKkxReefPMP7" },
  production: { program: "CXsKEJcs25TQEYU2e5jZ8QTPE3ffMLZhH6BWHrdcCCB5", state: "8QoomCQyPSkJ8WopJbX9B4HyvrFzziwvJdU8hZE6DCr9" },
} as const;
export const crePda = pda(seed("cre.v2"));

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
  const xs = MARKETS.filter((m) => m.kind === "xstock") as readonly { symbol: string; xstock: string }[];
  const ids = xs.map((m) => m.xstock).join(",");
  const res = await fetch(`https://lite-api.jup.ag/price/v3?ids=${ids}`);
  if (!res.ok) throw new Error(`jupiter price ${res.status}`);
  const body = (await res.json()) as Record<string, any>;
  const open = nyseOpen();
  const now = Math.floor(Date.now() / 1000);
  const out: Quote[] = [];
  for (const m of xs) {
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
  // GLDY: Orca's GLDY/USDC whirlpool, guarded by the gold spot price.
  for (const m of MARKETS.filter((m) => m.kind === "gold") as readonly { symbol: string; orcaPool: string }[]) {
    try {
      const pool = (await (await fetch(`https://api.orca.so/v2/solana/pools/${m.orcaPool}`)).json()).data;
      const spot = Number((await (await fetch("https://api.gold-api.com/price/XAU")).json()).price) || 0;
      const sqrt = Number(BigInt(pool.sqrtPrice)) / 2 ** 64;
      const usdcPerGldy = 1 / (sqrt * sqrt * 10 ** (6 - 9));
      const usePool = spot > 0 && Math.abs(usdcPerGldy / spot - 1) < 0.03;
      const price = usePool ? usdcPerGldy : spot;
      if (!(price > 0)) continue;
      const ny = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
      const d = ny.getDay(), min = ny.getHours() * 60 + ny.getMinutes();
      const goldOpen = d === 6 ? false : d === 0 ? min >= 18 * 60 : d === 5 ? min < 17 * 60 : true;
      out.push({ symbol: m.symbol, priceE8: BigInt(Math.round(price * 1e8)), publishTime: now, sessionOpen: goldOpen, source: usePool ? "Orca GLDY pool" : "gold spot" });
    } catch {}
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
      if ((await conn.getBlockHeight("confirmed")) > lastValidBlockHeight) break;
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
