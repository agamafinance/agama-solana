// The keeper: relays prices and runs the agents. Anyone can run the agent half;
// only the price half needs the keeper key.
//
//   every tick (30 s)
//     prices   push each market when it moved or is getting old; a move larger
//              than the program's 15% bound is walked in 14% steps
//     agents   for every open position, simulate `rebalance` and `compound`,
//              and send the ones that would do something
//
//   pnpm keeper            loop forever
//   pnpm keeper --once     one tick, then exit
//   --agents-only          skip the price half (anyone can run this)
import { BN } from "@coral-xyz/anchor";
import { PublicKey, Transaction } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { MARKETS, connection, fetchQuotes, keeperKeypair, marketAccounts, programFor, rails } from "./common";

const TICK_MS = Number(process.env.TICK_MS ?? 30_000);
const REPUSH_AGE = 240; // seconds; the program's max_age is 600
const MAX_STEP_BPS = 1400n;

const conn = connection();
const keeper = keeperKeypair();
const program = programFor(keeper, conn);
const accounts = program.account as any;

const log = (...a: unknown[]) => console.log(new Date().toISOString(), ...a);

async function pushPrices() {
  const quotes = await fetchQuotes();
  const now = Math.floor(Date.now() / 1000);
  for (const q of quotes) {
    const { market } = marketAccounts(q.symbol);
    const m = await accounts.market.fetch(market);
    const cur = BigInt(m.priceE8.toString());
    const age = now - Number(m.priceTime);
    const moved = cur === 0n ? true : (q.priceE8 > cur ? q.priceE8 - cur : cur - q.priceE8) * 10_000n > cur * 10n;
    if (!moved && age < REPUSH_AGE && m.sessionOpen === q.sessionOpen) continue;
    let target = q.priceE8;
    if (cur > 0n) {
      const cap = (cur * MAX_STEP_BPS) / 10_000n;
      if (target > cur + cap) target = cur + cap;
      if (target < cur - cap) target = cur - cap;
    }
    const publishTime = Math.max(q.publishTime, Number(m.priceTime));
    try {
      const sig = await program.methods
        .pushPrice(new BN(target.toString()), new BN(publishTime), q.sessionOpen)
        .accountsPartial({ keeper: keeper.publicKey, protocol: rails(q.symbol).protocol, market })
        .rpc();
      log(`price ${q.symbol} ${(Number(target) / 1e8).toFixed(2)} (${q.source})`, sig.slice(0, 16));
    } catch (e: any) {
      log(`price ${q.symbol} failed: ${e.message?.split("\n")[0]}`);
    }
  }
}

const OPS = ["", "borrowed more", "repaid from yield", "compounded into stock", "deleveraged", "liquidated", "bought more", "sold to repay"];

async function runAgents() {
  const positions = await accounts.position.all();
  const byMarket = new Map<string, string>();
  for (const m of MARKETS) byMarket.set(marketAccounts(m.symbol).market.toBase58(), m.symbol);
  for (const { publicKey, account } of positions) {
    const symbol = byMarket.get(account.market.toBase58());
    if (!symbol) continue;
    const kinds = account.kind === 0 ? ["compound", "rebalance"] : ["rebalance"];
    for (const ix of kinds) {
      const built = await (program.methods as any)
        [ix]()
        .accountsPartial({
          caller: keeper.publicKey,
          position: publicKey,
          ...rails(symbol),
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .instruction();
      const tx = new Transaction().add(built);
      tx.feePayer = keeper.publicKey;
      tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
      const sim = await conn.simulateTransaction(tx);
      if (sim.value.err) continue; // nothing to do: on target, or no yield yet
      tx.sign(keeper);
      const sig = await conn.sendRawTransaction(tx.serialize());
      await conn.confirmTransaction(sig, "confirmed");
      const after = await accounts.position.fetch(publicKey);
      log(`agent ${ix} ${symbol} ${publicKey.toBase58().slice(0, 8)}: ${OPS[after.lastAgentOp]}`, sig.slice(0, 16));
    }
  }
}

const AGENTS_ONLY = process.argv.includes("--agents-only");

async function tick() {
  try {
    if (!AGENTS_ONLY) await pushPrices();
  } catch (e: any) {
    log("prices:", e.message);
  }
  try {
    await runAgents();
  } catch (e: any) {
    log("agents:", e.message);
  }
}

async function main() {
  log("keeper", keeper.publicKey.toBase58(), "balance", (await conn.getBalance(keeper.publicKey)) / 1e9, "SOL");
  await tick();
  if (process.argv.includes("--once")) return;
  setInterval(tick, TICK_MS);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

export { PublicKey };
