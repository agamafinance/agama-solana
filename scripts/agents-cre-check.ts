// Prepares and verifies the CRE agents workflow against a local validator:
//   prepare  open an Earn position at 20%, then move TSLA +10% (keeper key)
//   verify   the position is back at 20%, and the CRE agent key did it
import { BN } from "@coral-xyz/anchor";
import { Keypair, LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import fs from "fs";
import { RPC, ata, connection, keeperKeypair, loadKeypair, marketAccounts, positionPda, programFor, protocolPda, rails } from "./common";

if (!/127\.0\.0\.1|localhost/.test(RPC)) throw new Error("local validator only");
const conn = connection();
const STATE = "/tmp/agents-cre-check.json";
const sys = { tokenProgram: TOKEN_2022_PROGRAM_ID, associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId };

async function prepare() {
  const user = Keypair.generate();
  await conn.confirmTransaction(await conn.requestAirdrop(user.publicKey, 2 * LAMPORTS_PER_SOL));
  const p = programFor(user, conn);
  const t = marketAccounts("TSLA");
  const keeper = programFor(keeperKeypair(), conn);
  const m: any = await (keeper.account as any).market.fetch(t.market);
  const now = Math.max(Math.floor(Date.now() / 1000), Number(m.priceTime));
  await keeper.methods.pushPrice(m.priceE8, new BN(now), true).accountsPartial({ keeper: keeperKeypair().publicKey, protocol: protocolPda, market: t.market }).rpc();
  const f = await p.methods.faucetStock().accountsPartial({ user: user.publicKey, protocol: protocolPda, market: t.market, stockMint: t.stockMint, userStock: ata(user.publicKey, t.stockMint), ...sys }).instruction();
  await p.methods
    .earnDeposit(new BN(10e8), 2000)
    .accountsPartial({ user: user.publicKey, position: positionPda(user.publicKey, t.market, "earn"), ...rails("TSLA"), userStock: ata(user.publicKey, t.stockMint), tokenProgram: TOKEN_2022_PROGRAM_ID, systemProgram: SystemProgram.programId })
    .preInstructions([f])
    .rpc();
  const up = (BigInt(m.priceE8.toString()) * 110n) / 100n;
  await keeper.methods.pushPrice(new BN(up.toString()), new BN(now + 1), true).accountsPartial({ keeper: keeperKeypair().publicKey, protocol: protocolPda, market: t.market }).rpc();
  fs.writeFileSync(STATE, JSON.stringify({ owner: user.publicKey.toBase58() }));
  console.log("prepared: Earn 10 TSLA at 20%, then TSLA +10%");
}

async function verify(agentFile: string) {
  const { owner } = JSON.parse(fs.readFileSync(STATE, "utf8"));
  const p = programFor(loadKeypair(), conn);
  const pos: any = await (p.account as any).position.fetch(positionPda(new (require("@solana/web3.js").PublicKey)(owner), marketAccounts("TSLA").market, "earn"));
  const agent = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(agentFile, "utf8")))).publicKey;
  const ok = pos.lastAgentOp === 1 && pos.lastAgent.equals(agent);
  console.log(`${ok ? "PASS" : "FAIL"}  CRE agent borrowed more (op ${pos.lastAgentOp}, by ${pos.lastAgent.toBase58().slice(0, 8)}, agent ${agent.toBase58().slice(0, 8)})`);
  process.exit(ok ? 0 : 1);
}

(process.argv[2] === "verify" ? verify(process.argv[3]) : prepare()).catch((e) => {
  console.error(e);
  process.exit(1);
});
