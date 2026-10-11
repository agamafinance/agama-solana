// Shared wiring for the Agama-on-Solana scripts: PDAs, the program client, the
// four markets and where their prices come from.
import fs from "fs";
import os from "os";
import path from "path";
import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";

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

export const seed = (s: string) => Buffer.from(s);
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

/// Chainlink's Data Streams Verifier on Solana devnet, its config PDA, and the
/// access controller it names (disabled on devnet: anyone may verify).
export const VERIFIER = new PublicKey("Gt9S41PtjR58CbG9JhJ3J6vxesqrNAswbWYbLNTMZA3c");
export const VERIFIER_ACCOUNT = PublicKey.findProgramAddressSync([Buffer.from("verifier")], VERIFIER)[0];
export const ACCESS_CONTROLLER = new PublicKey("2k3DsgwBoqrnvXKVvd7jX7aptNxdcRBdcd5HkYsGgbrb");

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
