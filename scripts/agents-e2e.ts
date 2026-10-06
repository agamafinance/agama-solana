// The agents, end to end, through the real keeper process. Local validator only:
// it moves prices with the keeper key, which on devnet would fight the relay.
//
//   1. Earn on TSLA at 20%, Amplify on SPY at 1.6x, Earn on NVDA at 30%
//   2. TSLA +10%     keeper --agents-only  -> Earn borrowed more, back at 20%
//   3. TSLA -20%     keeper --agents-only  -> Earn repaid from yield, stock untouched
//   4. SPY  +10%     keeper --agents-only  -> Amplify bought more, back at the multiple
//   5. SPY  -15%     keeper --agents-only  -> Amplify sold to repay
//   6. NVDA -30%     liquidate             -> the buffer repays, no stock taken
//   7. a stranger    rebalance on target   -> refused
import { execFileSync } from "child_process";
import { BN } from "@coral-xyz/anchor";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import {
  RPC,
  ROOT,
  ata,
  connection,
  keeperKeypair,
  marketAccounts,
  positionPda,
  programFor,
  protocolPda,
  rails,
  usdcMint,
} from "./common";

if (!/127\.0\.0\.1|localhost/.test(RPC)) {
  console.error("agents-e2e moves prices with the keeper key: local validator only (SOLANA_RPC=http://127.0.0.1:8899)");
  process.exit(1);
}

const conn = connection();
const keeper = keeperKeypair();
const kp = programFor(keeper, conn);
const sys = {
  tokenProgram: TOKEN_2022_PROGRAM_ID,
  associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
  systemProgram: SystemProgram.programId,
};
let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

async function movePrice(symbol: string, factor: number) {
  const { market } = marketAccounts(symbol);
  let m = await (kp.account as any).market.fetch(market);
  const target = BigInt(Math.round(Number(m.priceE8) * factor));
  // The program caps a push at 15%: walk there in 10% steps.
  for (;;) {
    m = await (kp.account as any).market.fetch(market);
    const cur = BigInt(m.priceE8.toString());
    if (cur === target) return;
    const step = cur / 10n;
    const next = target > cur ? (cur + step < target ? cur + step : target) : cur - step > target ? cur - step : target;
    const now = Math.max(Math.floor(Date.now() / 1000), Number(m.priceTime));
    await kp.methods
      .pushPrice(new BN(next.toString()), new BN(now), true)
      .accountsPartial({ keeper: keeper.publicKey, protocol: protocolPda, market })
      .rpc();
  }
}

/// Flag the session open at the current price, so the full LTVs apply.
async function openSession(symbol: string) {
  const { market } = marketAccounts(symbol);
  const m = await (kp.account as any).market.fetch(market);
  const now = Math.max(Math.floor(Date.now() / 1000), Number(m.priceTime));
  await kp.methods
    .pushPrice(m.priceE8, new BN(now), true)
    .accountsPartial({ keeper: keeper.publicKey, protocol: protocolPda, market })
    .rpc();
}

function runAgents(): string {
  return execFileSync(`${ROOT}/node_modules/.bin/tsx`, ["scripts/keeper.ts", "--once", "--agents-only"], {
    cwd: ROOT,
    env: process.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
}

async function ltvBps(position: PublicKey, symbol: string) {
  const a = kp.account as any;
  const p = await a.protocol.fetch(protocolPda);
  const m = await a.market.fetch(marketAccounts(symbol).market);
  const s = await a.position.fetch(position);
  const debt = (BigInt(s.scaledDebt.toString()) * BigInt(p.borrowIndex.toString())) / 10n ** 18n;
  const value = (BigInt(s.collateral.toString()) * BigInt(m.priceE8.toString())) / 10n ** 10n;
  return { ltv: Number((debt * 10_000n) / value), s };
}

async function main() {
  const user = Keypair.generate();
  await conn.confirmTransaction(await conn.requestAirdrop(user.publicKey, 2 * LAMPORTS_PER_SOL));
  const up = programFor(user, conn);

  // Funds: USDC + TSLA, SPY, NVDA.
  const ixs = [
    await up.methods
      .faucetUsdc()
      .accountsPartial({ user: user.publicKey, protocol: protocolPda, usdcMint, userUsdc: ata(user.publicKey, usdcMint), ...sys })
      .instruction(),
  ];
  for (const s of ["TSLA", "SPY", "NVDA"]) {
    const m = marketAccounts(s);
    ixs.push(
      await up.methods
        .faucetStock()
        .accountsPartial({ user: user.publicKey, protocol: protocolPda, market: m.market, stockMint: m.stockMint, userStock: ata(user.publicKey, m.stockMint), ...sys })
        .instruction(),
    );
  }
  await up.methods.poke().accountsPartial({ protocol: protocolPda }).preInstructions(ixs).rpc();

  for (const s of ["TSLA", "SPY", "NVDA"]) await openSession(s);
  const earnOpen = (s: string, ltv: number) =>
    up.methods
      .earnDeposit(new BN(10e8), ltv)
      .accountsPartial({ user: user.publicKey, position: positionPda(user.publicKey, marketAccounts(s).market, "earn"), ...rails(s), userStock: ata(user.publicKey, marketAccounts(s).stockMint), tokenProgram: TOKEN_2022_PROGRAM_ID, systemProgram: SystemProgram.programId })
      .rpc();
  await earnOpen("TSLA", 2000);
  await earnOpen("NVDA", 2900);
  const spy = marketAccounts("SPY");
  const amp = positionPda(user.publicKey, spy.market, "amplify");
  await up.methods
    .amplifyOpen(new BN(10e8), 16000)
    .accountsPartial({ user: user.publicKey, position: amp, ...rails("SPY"), userStock: ata(user.publicKey, spy.stockMint), tokenProgram: TOKEN_2022_PROGRAM_ID, systemProgram: SystemProgram.programId })
    .rpc();
  const tslaPos = positionPda(user.publicKey, marketAccounts("TSLA").market, "earn");
  const nvdaPos = positionPda(user.publicKey, marketAccounts("NVDA").market, "earn");
  const ampTarget = (await ltvBps(amp, "SPY")).s.targetLtvBps;
  check("positions open", true, `TSLA earn 20%, NVDA earn 29%, SPY amplify 1.6x (LTV ${ampTarget / 100}%)`);

  // Nothing to do yet: the keeper must leave them alone.
  const quiet = runAgents();
  check("agents idle while on target", !quiet.includes(user.publicKey.toBase58().slice(0, 8)) && !/agent \w+ (TSLA|SPY|NVDA)/.test(quiet), quiet.trim().split("\n").slice(-1)[0]);

  await movePrice("TSLA", 1.1);
  let out = runAgents();
  let r = await ltvBps(tslaPos, "TSLA");
  check("TSLA +10%: keeper borrowed more", r.s.lastAgentOp === 1 && r.s.lastAgent.equals(keeper.publicKey), `op ${r.s.lastAgentOp}`);
  check("TSLA back at 20%", Math.abs(r.ltv - 2000) <= 5, `LTV ${r.ltv / 100}%`);

  await movePrice("TSLA", 0.8);
  out = runAgents();
  r = await ltvBps(tslaPos, "TSLA");
  check("TSLA -20%: keeper repaid from yield", r.s.lastAgentOp === 2, `op ${r.s.lastAgentOp}`);
  check("TSLA stock untouched", r.s.collateral.toString() === String(10e8), `${Number(r.s.collateral) / 1e8} TSLA`);
  check("TSLA back at 20%", Math.abs(r.ltv - 2000) <= 5, `LTV ${r.ltv / 100}%`);

  await movePrice("SPY", 1.1);
  out = runAgents();
  r = await ltvBps(amp, "SPY");
  check("SPY +10%: keeper bought more SPY", r.s.lastAgentOp === 6, `op ${r.s.lastAgentOp}, ${(Number(r.s.collateral) / 1e8).toFixed(4)} SPY`);
  check("SPY back at the multiple", Math.abs(r.ltv - ampTarget) <= 5, `LTV ${r.ltv / 100}% vs ${ampTarget / 100}%`);

  await movePrice("SPY", 0.85);
  out = runAgents();
  r = await ltvBps(amp, "SPY");
  check("SPY -15%: keeper sold to repay", r.s.lastAgentOp === 7, `op ${r.s.lastAgentOp}`);
  check("SPY back at the multiple", Math.abs(r.ltv - ampTarget) <= 5, `LTV ${r.ltv / 100}% vs ${ampTarget / 100}%`);

  // NVDA: nobody rebalances (we skip the keeper), the price falls through the threshold.
  await movePrice("NVDA", 0.7);
  const liq = Keypair.generate();
  await conn.confirmTransaction(await conn.requestAirdrop(liq.publicKey, LAMPORTS_PER_SOL));
  const lp = programFor(liq, conn);
  const nvda = marketAccounts("NVDA");
  await lp.methods
    .liquidate(new BN(1000e6))
    .accountsPartial({ liquidator: liq.publicKey, position: nvdaPos, ...rails("NVDA"), liquidatorUsdc: ata(liq.publicKey, usdcMint), liquidatorStock: ata(liq.publicKey, nvda.stockMint), ...sys })
    .preInstructions([
      await lp.methods
        .faucetUsdc()
        .accountsPartial({ user: liq.publicKey, protocol: protocolPda, usdcMint, userUsdc: ata(liq.publicKey, usdcMint), ...sys })
        .instruction(),
    ])
    .rpc();
  r = await ltvBps(nvdaPos, "NVDA");
  check("NVDA -30%: buffer repaid before any liquidation", r.s.lastAgentOp === 4, `op ${r.s.lastAgentOp}`);
  check("NVDA stock untouched", r.s.collateral.toString() === String(10e8));

  // A stranger calling an agent on a position that is on target.
  try {
    await lp.methods.rebalance().accountsPartial({ caller: liq.publicKey, position: tslaPos, ...rails("TSLA"), tokenProgram: TOKEN_2022_PROGRAM_ID }).rpc();
    check("rebalance on target refused", false);
  } catch (e: any) {
    check("rebalance on target refused", String(e).includes("AlreadyOnTarget"));
  }

  // Closing everything: stock back.
  await up.methods
    .amplifyClose()
    .accountsPartial({ user: user.publicKey, position: amp, ...rails("SPY"), userStock: ata(user.publicKey, spy.stockMint), ...sys })
    .rpc();
  for (const s of ["TSLA", "NVDA"]) {
    const m = marketAccounts(s);
    await up.methods
      .earnClose()
      .accountsPartial({ user: user.publicKey, position: positionPda(user.publicKey, m.market, "earn"), ...rails(s), userUsdc: ata(user.publicKey, usdcMint), userStock: ata(user.publicKey, m.stockMint), ...sys })
      .rpc();
    const bal = (await conn.getTokenAccountBalance(ata(user.publicKey, m.stockMint))).value.uiAmount;
    check(`${s} earn closed, every share back`, bal === 10, `${bal} ${s}`);
  }
  const spyBack = (await conn.getTokenAccountBalance(ata(user.publicKey, spy.stockMint))).value.uiAmount ?? 0;
  check("SPY amplify closed", spyBack > 9 && spyBack < 10.5, `${spyBack} SPY`);

  console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
