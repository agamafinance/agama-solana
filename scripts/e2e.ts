// End to end on devnet with real transactions, from a fresh wallet:
// faucet, Earn open, move the slider, Amplify open and close, Lend, Earn close.
// Prints an explorer link for every step.
import { BN } from "@coral-xyz/anchor";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import {
  ata,
  connection,
  loadKeypair,
  lpMint,
  marketAccounts,
  poolUsdc,
  positionPda,
  programFor,
  protocolPda,
  rails,
  usdcMint,
  sweep,
} from "./common";

const conn = connection();
const admin = loadKeypair();
const sys = {
  tokenProgram: TOKEN_2022_PROGRAM_ID,
  associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
  systemProgram: SystemProgram.programId,
};
const link = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
let n = 0;
const step = (name: string, sig: string) => console.log(`${String(++n).padStart(2)}. ${name.padEnd(34)} ${link(sig)}`);

async function main() {
  const user = Keypair.generate();
  await sendAndConfirmTransaction(
    conn,
    new Transaction().add(
      SystemProgram.transfer({ fromPubkey: admin.publicKey, toPubkey: user.publicKey, lamports: 0.03 * LAMPORTS_PER_SOL }),
    ),
    [admin],
  );
  console.log("user", user.publicKey.toBase58());
  const program = programFor(user, conn);
  const acc = program.account as any;
  const tsla = marketAccounts("TSLA");
  const spy = marketAccounts("SPY");

  // 1. Faucet: USDC plus TSLA and SPY in one transaction.
  const faucetIxs = [
    await program.methods
      .faucetUsdc()
      .accountsPartial({ user: user.publicKey, protocol: protocolPda, usdcMint, userUsdc: ata(user.publicKey, usdcMint), ...sys })
      .instruction(),
  ];
  for (const m of [tsla, spy]) {
    faucetIxs.push(
      await program.methods
        .faucetStock()
        .accountsPartial({
          user: user.publicKey,
          protocol: protocolPda,
          market: m.market,
          stockMint: m.stockMint,
          userStock: ata(user.publicKey, m.stockMint),
          ...sys,
        })
        .instruction(),
    );
  }
  step("faucet: 10k USDC, 10 TSLA, 10 SPY", await sendAndConfirmTransaction(conn, new Transaction().add(...faucetIxs), [user]));

  // 2. Earn on TSLA at 20%.
  const earn = positionPda(user.publicKey, tsla.market, "earn");
  step(
    "earn: deposit 10 TSLA at 20% LTV",
    await program.methods
      .earnDeposit(new BN(10 * 1e8), 2000)
      .accountsPartial({
        user: user.publicKey,
        position: earn,
        ...rails("TSLA"),
        userStock: ata(user.publicKey, tsla.stockMint),
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc(),
  );
  const p0 = await acc.position.fetch(earn);
  console.log(`    collateral ${p0.collateral / 1e8} TSLA, vault shares ${(p0.shares / 1e6).toFixed(2)}`);

  // 3. Slider up to 24% (under the 25% off-hours cap).
  step(
    "earn: move the slider to 24%",
    await program.methods
      .earnSetTarget(2400)
      .accountsPartial({ user: user.publicKey, position: earn, ...rails("TSLA"), tokenProgram: TOKEN_2022_PROGRAM_ID })
      .rpc(),
  );

  // 4. Amplify SPY 1.6x.
  const amp = positionPda(user.publicKey, spy.market, "amplify");
  step(
    "amplify: 10 SPY at 1.6x",
    await program.methods
      .amplifyOpen(new BN(10 * 1e8), 16000)
      .accountsPartial({
        user: user.publicKey,
        position: amp,
        ...rails("SPY"),
        userStock: ata(user.publicKey, spy.stockMint),
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc(),
  );
  const a0 = await acc.position.fetch(amp);
  console.log(`    collateral ${(a0.collateral / 1e8).toFixed(4)} SPY, target LTV ${a0.targetLtvBps / 100}%`);

  // 5. Lend 1000 USDC, take it back.
  const lend = {
    user: user.publicKey,
    protocol: protocolPda,
    usdcMint,
    lpMint,
    poolUsdc,
    userUsdc: ata(user.publicKey, usdcMint),
    userLp: ata(user.publicKey, lpMint),
    ...sys,
  };
  step("lend: supply 1000 USDC", await program.methods.supply(new BN(1000e6)).accountsPartial(lend).rpc());
  const lp = (await conn.getTokenAccountBalance(ata(user.publicKey, lpMint))).value.amount;
  step("lend: withdraw it all", await program.methods.withdraw(new BN(lp)).accountsPartial(lend).rpc());

  // 6. An agent call from a stranger: on target, so it must refuse.
  const stranger = programFor(admin, conn);
  try {
    await stranger.methods
      .rebalance()
      .accountsPartial({ caller: admin.publicKey, position: earn, ...rails("TSLA"), tokenProgram: TOKEN_2022_PROGRAM_ID })
      .rpc();
    throw new Error("rebalance on target should have refused");
  } catch (e: any) {
    if (!String(e).includes("AlreadyOnTarget")) throw e;
    console.log(`${String(++n).padStart(2)}. agent: rebalance on target refuses   AlreadyOnTarget`);
  }

  // 7. Close both.
  step(
    "amplify: close, stock back",
    await program.methods
      .amplifyClose()
      .accountsPartial({ user: user.publicKey, position: amp, ...rails("SPY"), userStock: ata(user.publicKey, spy.stockMint), ...sys })
      .rpc(),
  );
  step(
    "earn: close, stock back",
    await program.methods
      .earnClose()
      .accountsPartial({
        user: user.publicKey,
        position: earn,
        ...rails("TSLA"),
        userUsdc: ata(user.publicKey, usdcMint),
        userStock: ata(user.publicKey, tsla.stockMint),
        ...sys,
      })
      .rpc(),
  );
  const tslaBack = (await conn.getTokenAccountBalance(ata(user.publicKey, tsla.stockMint))).value.uiAmount;
  const spyBack = (await conn.getTokenAccountBalance(ata(user.publicKey, spy.stockMint))).value.uiAmount;
  console.log(`    back in the wallet: ${tslaBack} TSLA, ${spyBack} SPY`);
  if (tslaBack !== 10) throw new Error("earn close must hand back every TSLA");
  await sweep(conn, user, admin.publicKey);
  console.log("PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
