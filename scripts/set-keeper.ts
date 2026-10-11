// Admin: who may call `push_price`, the unverified price path the program keeps
// for emergencies and local tests. On devnet it is the admin key: the keeper
// only sends Chainlink reports through `push_report`, which needs no key.
// Usage: tsx scripts/set-keeper.ts [pubkey]   (default: the admin key)
import { PublicKey } from "@solana/web3.js";
import { connection, loadKeypair, programFor, protocolPda } from "./common";

async function main() {
  const admin = loadKeypair();
  const program = programFor(admin, connection());
  const keeper = new PublicKey(process.argv[2] ?? admin.publicKey);
  const p: any = await (program.account as any).protocol.fetch(protocolPda);
  if (p.keeper.equals(keeper)) return console.log("keeper already", keeper.toBase58());
  const sig = await program.methods
    .setParams({
      keeper,
      baseRateBps: p.baseRateBps,
      slope1Bps: p.slope1Bps,
      slope2Bps: p.slope2Bps,
      kinkBps: p.kinkBps,
      vaultAprBps: p.vaultAprBps,
      minBorrow: p.minBorrow,
      minCompound: p.minCompound,
      dexFeeBps: p.dexFeeBps,
    })
    .accountsPartial({ admin: admin.publicKey, protocol: protocolPda })
    .rpc();
  const q: any = await (program.account as any).protocol.fetch(protocolPda);
  console.log("keeper", p.keeper.toBase58(), "->", q.keeper.toBase58(), sig.slice(0, 16));
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
