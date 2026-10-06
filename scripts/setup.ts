// One-shot initialisation after `solana program deploy`. Idempotent: each step
// is skipped if already done.
//
//   1. initialize   protocol PDA, devnet USDC + LP mints, pool and vault accounts
//   2. add_market   TSLA / NVDA / AAPL / SPY stand-ins, custody per market
//   3. push_price   first price for each, from the live xStocks
//   4. supply       seed the pool with faucet USDC so there is something to borrow
import { BN } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  CRE_FORWARDERS,
  MARKETS,
  crePda,
  ata,
  connection,
  fetchQuotes,
  keeperKeypair,
  loadKeypair,
  lpMint,
  marketAccounts,
  poolUsdc,
  programFor,
  protocolPda,
  symbolBytes,
  usdcMint,
  vaultUsdc,
} from "./common";

const SEED_POOL_USDC = Number(process.env.SEED_POOL_USDC ?? 200_000);

async function main() {
  const conn = connection();
  const admin = loadKeypair();
  const keeper = keeperKeypair();
  const program = programFor(admin, conn);
  console.log("admin ", admin.publicKey.toBase58());
  console.log("keeper", keeper.publicKey.toBase58());

  if (!(await conn.getAccountInfo(protocolPda))) {
    const sig = await program.methods
      .initialize({
        keeper: keeper.publicKey,
        baseRateBps: 200,
        slope1Bps: 600,
        slope2Bps: 6000,
        kinkBps: 8000,
        vaultAprBps: 1100,
        minBorrow: new BN(1_000_000),
        minCompound: new BN(100_000),
        dexFeeBps: 5,
      })
      .accountsPartial({
        admin: admin.publicKey,
        protocol: protocolPda,
        usdcMint,
        lpMint,
        poolUsdc,
        vaultUsdc,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log("initialize", sig);
  } else console.log("protocol exists");

  for (const m of MARKETS) {
    const acc = marketAccounts(m.symbol);
    if (await conn.getAccountInfo(acc.market)) {
      console.log(m.symbol, "exists");
      continue;
    }
    const sig = await program.methods
      .addMarket(symbolBytes(m.symbol), {
        ltvBps: m.ltv,
        ltBps: m.lt,
        liqBonusBps: 500,
        offhoursBufferBps: 500,
        maxAge: 600,
        maxJumpBps: 1500,
      })
      .accountsPartial({
        admin: admin.publicKey,
        protocol: protocolPda,
        stockMint: acc.stockMint,
        market: acc.market,
        custody: acc.custody,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log("add_market", m.symbol, sig);
  }

  // The keeper pays for its own price pushes.
  const keeperBal = await conn.getBalance(keeper.publicKey);
  if (keeperBal < 0.05 * LAMPORTS_PER_SOL) {
    await sendAndConfirmTransaction(
      conn,
      new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: admin.publicKey,
          toPubkey: keeper.publicKey,
          lamports: 0.1 * LAMPORTS_PER_SOL,
        }),
      ),
      [admin],
    );
    console.log("funded keeper with 0.1 SOL");
  }

  const keeperProgram = programFor(keeper, conn);
  const quotes = await fetchQuotes();
  for (const q of quotes) {
    const acc = marketAccounts(q.symbol);
    const state: any = await (program.account as any).market.fetch(acc.market);
    if (state.priceE8.toString() !== "0") continue;
    const sig = await keeperProgram.methods
      .pushPrice(new BN(q.priceE8.toString()), new BN(q.publishTime), q.sessionOpen)
      .accountsPartial({ keeper: keeper.publicKey, protocol: protocolPda, market: acc.market })
      .rpc();
    console.log("first price", q.symbol, Number(q.priceE8) / 1e8, q.source, sig);
  }

  const p: any = await (program.account as any).protocol.fetch(protocolPda);
  if (BigInt(p.cash.toString()) < BigInt(SEED_POOL_USDC) * 1_000_000n / 2n) {
    const rounds = Math.ceil(SEED_POOL_USDC / 10_000);
    for (let i = 0; i < rounds; i += 8) {
      const ixs = [];
      for (let j = i; j < Math.min(i + 8, rounds); j++) {
        ixs.push(
          await program.methods
            .faucetUsdc()
            .accountsPartial({
              user: admin.publicKey,
              protocol: protocolPda,
              usdcMint,
              userUsdc: ata(admin.publicKey, usdcMint),
              tokenProgram: TOKEN_2022_PROGRAM_ID,
              associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
              systemProgram: SystemProgram.programId,
            })
            .instruction(),
        );
      }
      await sendAndConfirmTransaction(conn, new Transaction().add(...ixs), [admin]);
    }
    const sig = await program.methods
      .supply(new BN(SEED_POOL_USDC).mul(new BN(1_000_000)))
      .accountsPartial({
        user: admin.publicKey,
        protocol: protocolPda,
        usdcMint,
        lpMint,
        poolUsdc,
        userUsdc: ata(admin.publicKey, usdcMint),
        userLp: ata(admin.publicKey, lpMint),
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log(`seeded pool with ${SEED_POOL_USDC} USDC`, sig);
  }
  // Chainlink CRE: point the receiver at the forwarder. CRE_MODE=production
  // switches to the live Keystone Forwarder once the workflow runs on the DON;
  // CRE_WORKFLOW_OWNER (0x...) pins the workflow owner.
  const mode = (process.env.CRE_MODE ?? "simulation") as keyof typeof CRE_FORWARDERS;
  const fwd = CRE_FORWARDERS[mode];
  const ownerHex = (process.env.CRE_WORKFLOW_OWNER ?? "").replace(/^0x/, "");
  const owner = ownerHex ? [...Buffer.from(ownerHex.padStart(40, "0"), "hex")] : new Array(20).fill(0);
  const cur: any = await (program.account as any).creConfig.fetchNullable(crePda);
  if (!cur || cur.forwarderProgram.toBase58() !== fwd.program || Buffer.from(cur.workflowOwner).toString("hex") !== Buffer.from(owner).toString("hex")) {
    const sig = await program.methods
      .setCre(new PublicKey(fwd.program), new PublicKey(fwd.state), owner, mode === "simulation")
      .accountsPartial({ admin: admin.publicKey, protocol: protocolPda, cre: crePda, systemProgram: SystemProgram.programId })
      .rpc();
    console.log(`cre: ${mode} forwarder, owner ${ownerHex || "any"}`, sig);
  } else console.log("cre configured");
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
