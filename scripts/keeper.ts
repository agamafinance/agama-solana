// The keeper: relays prices and runs the agents. It needs no privileged key:
// prices are Chainlink Data Streams reports, verified on chain by Chainlink's
// Verifier (see oracle.ts), and the agents' instructions are permissionless.
//
//   every tick (30 s)
//     prices   send each market's latest signed report when the price moved or
//              is getting old; the program steps a move over 15% (15% a time)
//     agents   for every open position, simulate `rebalance` and `compound`,
//              and send the ones that would do something
//
//   pnpm keeper            loop forever
//   pnpm keeper --once     one tick, then exit
//   --agents-only          skip the price half (anyone can run this)
//   --stale-only           push a price only when the market is going stale
//                          (a fallback behind another keeper)
//   --minutes N            tick for N minutes, then exit (the always-on keeper
//                          on GitHub Actions: one long run per job, relaunched
//                          hourly); pushes on a 0.3% move or at 7 minutes old
import { BN } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { latestQuotes, pushReportIxs } from "./oracle";
import { MARKETS, ata, connection, keeperKeypair, lpMint, marketAccounts, poolUsdc, programFor, protocolPda, rails, sendReliably, usdcMint } from "./common";

const TICK_MS = Number(process.env.TICK_MS ?? 30_000);
const REPUSH_AGE = 240; // seconds; the program's max_age is 600
const STALE_ONLY = process.argv.includes("--stale-only");
const MINUTES = (() => {
  const i = process.argv.indexOf("--minutes");
  return i > 0 ? Number(process.argv[i + 1]) : 0;
})();
// The always-on keeper pays every push from one devnet key: push less often,
// still well inside the program's 10 minute max_age.
const AGE = MINUTES ? 420 : REPUSH_AGE;
const MOVE_BPS = MINUTES ? 30n : 10n;
const STALE_AGE = 420; // seconds: the main keeper reprices at 7 min at the latest

const conn = connection();
const keeper = keeperKeypair();
const program = programFor(keeper, conn);
const accounts = program.account as any;

const log = (...a: unknown[]) => console.log(new Date().toISOString(), ...a);

async function pushPrices() {
  const quotes = await latestQuotes();
  const now = Math.floor(Date.now() / 1000);
  for (const q of quotes) {
    const { market } = marketAccounts(q.symbol);
    const m = await accounts.market.fetch(market);
    const cur = BigInt(m.priceE8.toString());
    const age = now - Number(m.priceTime);
    // Only a report newer than the market's price can apply.
    if (q.publishTime <= Number(m.priceTime)) continue;
    const moved = cur === 0n ? true : (q.priceE8 > cur ? q.priceE8 - cur : cur - q.priceE8) * 10_000n > cur * MOVE_BPS;
    if (STALE_ONLY ? age < STALE_AGE : !moved && age < AGE && m.sessionOpen === q.sessionOpen) continue;
    try {
      const sig = await sendReliably(conn, await pushReportIxs(program, keeper.publicKey, q), [keeper]);
      log(`price ${q.symbol} ${(Number(q.priceE8) / 1e8).toFixed(2)} (${q.source}, verified on chain)`, sig.slice(0, 16));
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
      const sig = await sendReliably(conn, [built], [keeper]);
      const after = await accounts.position.fetch(publicKey);
      log(`agent ${ix} ${symbol} ${publicKey.toBase58().slice(0, 8)}: ${OPS[after.lastAgentOp]}`, sig.slice(0, 16));
    }
  }
}

/// Devnet only: the faucets are open, so anyone can borrow the pool dry with
/// faucet collateral. Below 150,000 USDC of cash the keeper mints stand-in USDC
/// and supplies it, so Earn and Amplify always have something to borrow.
const POOL_FLOOR = BigInt(process.env.KEEPER_POOL_FLOOR ?? 150_000) * 1_000_000n;
async function topUpPool() {
  const p: any = await accounts.protocol.fetch(protocolPda);
  const cash = BigInt(p.cash.toString());
  if (cash >= POOL_FLOOR) return;
  const sys = { tokenProgram: TOKEN_2022_PROGRAM_ID, associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId };
  const ixs = [];
  for (let i = 0; i < 8; i++)
    ixs.push(await program.methods.faucetUsdc().accountsPartial({ user: keeper.publicKey, protocol: protocolPda, usdcMint, userUsdc: ata(keeper.publicKey, usdcMint), ...sys }).instruction());
  ixs.push(
    await program.methods
      .supply(new BN(80_000).mul(new BN(1_000_000)))
      .accountsPartial({ user: keeper.publicKey, protocol: protocolPda, usdcMint, lpMint, poolUsdc, userUsdc: ata(keeper.publicKey, usdcMint), userLp: ata(keeper.publicKey, lpMint), ...sys })
      .instruction(),
  );
  const sig = await sendReliably(conn, ixs, [keeper]);
  log(`pool topped up: ${Number(cash) / 1e6} USDC of cash + 80,000`, sig.slice(0, 16));
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
  try {
    if (!AGENTS_ONLY) await topUpPool();
  } catch (e: any) {
    log("pool:", e.message);
  }
}

async function main() {
  log("keeper", keeper.publicKey.toBase58(), "balance", (await conn.getBalance(keeper.publicKey)) / 1e9, "SOL");
  await tick();
  if (process.argv.includes("--once")) return;
  if (MINUTES) {
    // Sequential ticks for a bounded run, then a clean exit.
    const end = Date.now() + MINUTES * 60_000;
    while (Date.now() + TICK_MS < end) {
      await new Promise((r) => setTimeout(r, TICK_MS));
      await tick();
    }
    log("keeper run done");
    return;
  }
  setInterval(tick, TICK_MS);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

export { PublicKey };
