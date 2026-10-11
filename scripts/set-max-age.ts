// Admin: set every market's max_age (seconds a price stays usable), keeping
// the other parameters. On devnet the demo runs on a long max_age so that a
// keeper outage freezes prices instead of refusing every deposit; the keeper
// still reprices every few minutes. Usage: tsx scripts/set-max-age.ts 604800
import { MARKETS, connection, loadKeypair, marketAccounts, programFor, protocolPda } from "./common";

async function main() {
  const maxAge = Number(process.argv[2] ?? 604800);
  const admin = loadKeypair();
  const conn = connection();
  const program = programFor(admin, conn);
  for (const m of MARKETS) {
    const { market } = marketAccounts(m.symbol);
    const a: any = await (program.account as any).market.fetch(market);
    if (Number(a.maxAge) === maxAge) {
      console.log(m.symbol, "already", maxAge);
      continue;
    }
    const sig = await program.methods
      .setMarket({
        ltvBps: a.ltvBps,
        ltBps: a.ltBps,
        liqBonusBps: a.liqBonusBps,
        offhoursBufferBps: a.offhoursBufferBps,
        maxAge,
        maxJumpBps: a.maxJumpBps,
      })
      .accountsPartial({ admin: admin.publicKey, protocol: protocolPda, market })
      .rpc();
    const b: any = await (program.account as any).market.fetch(market);
    console.log(m.symbol, "max_age", Number(a.maxAge), "->", Number(b.maxAge), "ltv", b.ltvBps, "lt", b.ltBps, sig.slice(0, 16));
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
