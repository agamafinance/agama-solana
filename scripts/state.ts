// Read the live protocol: pool, vault, markets, prices and their age, positions,
// keeper balance. Exits non-zero if a price is stale or the keeper is low.
import { MARKETS, connection, keeperKeypair, marketAccounts, programFor, protocolPda } from "./common";

async function main() {
  const conn = connection();
  const keeper = keeperKeypair();
  const program = programFor(keeper, conn);
  const a = program.account as any;
  const now = Math.floor(Date.now() / 1000);
  let bad = 0;

  const p = await a.protocol.fetch(protocolPda);
  const index = Number(p.borrowIndex) / 1e18;
  const debt = (Number(p.totalScaledDebt) * index) / 1e6;
  console.log(`pool    cash ${(Number(p.cash) / 1e6).toFixed(2)} USDC, debt ${debt.toFixed(2)} USDC, index ${index.toFixed(8)}`);
  console.log(`vault   ${(Number(p.vaultShares) / 1e6).toFixed(2)} shares at NAV ${(Number(p.navWad) / 1e18).toFixed(8)}, APR ${p.vaultAprBps / 100}%, coupons ${(Number(p.couponsPaid) / 1e6).toFixed(4)} USDC`);

  for (const m of MARKETS) {
    const s = await a.market.fetch(marketAccounts(m.symbol).market);
    const age = now - Number(s.priceTime);
    const stale = age > s.maxAge;
    if (stale) bad++;
    console.log(
      `${m.symbol.padEnd(5)}   $${(Number(s.priceE8) / 1e8).toFixed(2).padStart(8)}  ${String(age).padStart(4)} s old${stale ? " STALE" : ""}  ` +
        `${s.sessionOpen ? "session" : "off-hours"}  LTV ${s.ltvBps / 100}% (now ${(s.sessionOpen ? s.ltvBps : s.ltvBps - s.offhoursBufferBps) / 100}%)  ` +
        `collateral ${(Number(s.totalCollateral) / 1e8).toFixed(4)}`,
    );
  }

  const positions = await a.position.all();
  console.log(`positions ${positions.length}`);
  for (const { publicKey, account: s } of positions) {
    const sym = MARKETS.find((m) => marketAccounts(m.symbol).market.equals(s.market))?.symbol;
    console.log(
      `  ${publicKey.toBase58().slice(0, 8)} ${s.kind === 0 ? "earn   " : "amplify"} ${sym} ${(Number(s.collateral) / 1e8).toFixed(4)} ` +
        `debt ${((Number(s.scaledDebt) * index) / 1e6).toFixed(2)} target ${s.targetLtvBps / 100}% last op ${s.lastAgentOp}`,
    );
  }

  const bal = (await conn.getBalance(keeper.publicKey)) / 1e9;
  if (bal < 0.01) bad++;
  console.log(`keeper  ${keeper.publicKey.toBase58()} ${bal.toFixed(5)} SOL${bal < 0.01 ? " LOW" : ""}`);
  process.exit(bad ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
