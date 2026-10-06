// The private path, end to end, from two fresh wallets:
//
//   1. faucet           10k USDC + 10 TSLA land in Alice's public balance
//   2. shield           both go private; the public balance reads zero
//   3. private send     2 TSLA and 1,500 USDC to Bob, amounts hidden
//   4. what a stranger  sees: zero public balances, ciphertexts only
//   5. unshield         Alice takes 5 TSLA back out to deposit
//   6. earn             deposit those 5 TSLA at 20% (the protocol sees 5)
//   7. close            the stock comes back public, then is shielded again
//   8. Bob unshields    his USDC and supplies it to the pool
//
// Every balance below is decrypted with the owner's keys and checked exactly.
import { BN } from "@coral-xyz/anchor";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { fetchToken } from "@solana-program/token-2022";
import { RPC, ata, connection, loadKeypair, lpMint, marketAccounts, poolUsdc, positionPda, programFor, protocolPda, rails, sweep, usdcMint } from "./common";
import { ataOf, balances, keysFor, kitSignerFromSecret, rpc, sendPrivate, shield, toAddress, unshield, configure } from "./confidential";

const conn = connection();
const funder = loadKeypair();
const sys = { tokenProgram: TOKEN_2022_PROGRAM_ID, associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId };
const devnet = !/127\.0\.0\.1|localhost/.test(RPC);
const link = (sig: string) => (devnet ? `https://explorer.solana.com/tx/${sig}?cluster=devnet` : sig.slice(0, 16));
let failures = 0;
let step = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}
const log = (name: string, sigs: string[]) => console.log(`${String(++step).padStart(2)}. ${name.padEnd(30)} ${sigs.length} tx  ${sigs.map(link).join(" ")}`);
const fmt = (x: bigint, d: number) => (Number(x) / 10 ** d).toLocaleString("en-US", { maximumFractionDigits: 4 });

async function fund(k: Keypair, sol: number) {
  await sendAndConfirmTransaction(
    conn,
    new Transaction().add(SystemProgram.transfer({ fromPubkey: funder.publicKey, toPubkey: k.publicKey, lamports: sol * LAMPORTS_PER_SOL })),
    [funder],
  );
}

async function main() {
  const aliceKp = Keypair.generate();
  const bobKp = Keypair.generate();
  await fund(aliceKp, devnet ? 0.06 : 2);
  await fund(bobKp, devnet ? 0.04 : 2);
  const alice = await kitSignerFromSecret(aliceKp.secretKey);
  const bob = await kitSignerFromSecret(bobKp.secretKey);
  const ka = await keysFor(alice);
  const kb = await keysFor(bob);
  console.log("alice", alice.address, "\nbob  ", bob.address);

  const tsla = marketAccounts("TSLA");
  const USDC = toAddress(usdcMint);
  const TSLA = toAddress(tsla.stockMint);

  // 1. Faucet (public).
  const ap = programFor(aliceKp, conn);
  const fix = [
    await ap.methods.faucetUsdc().accountsPartial({ user: aliceKp.publicKey, protocol: protocolPda, usdcMint, userUsdc: ata(aliceKp.publicKey, usdcMint), ...sys }).instruction(),
    await ap.methods.faucetStock().accountsPartial({ user: aliceKp.publicKey, protocol: protocolPda, market: tsla.market, stockMint: tsla.stockMint, userStock: ata(aliceKp.publicKey, tsla.stockMint), ...sys }).instruction(),
  ];
  log("faucet (public)", [await sendAndConfirmTransaction(conn, new Transaction().add(...fix), [aliceKp])]);

  // 2. Shield everything.
  log("shield 10,000 USDC", await shield(alice, ka, USDC, 6));
  log("shield 10 TSLA", await shield(alice, ka, TSLA, 8));
  let a = await balances(alice.address, ka, TSLA);
  let au = await balances(alice.address, ka, USDC);
  check("alice TSLA private, public zero", a.private === 10n * 10n ** 8n && a.public === 0n, `${fmt(a.private, 8)} private, ${fmt(a.public, 8)} public`);
  check("alice USDC private, public zero", au.private === 10_000n * 10n ** 6n && au.public === 0n);

  // 3. Private sends to Bob.
  log("bob configures TSLA + USDC", [...(await configure(bob, kb, TSLA)), ...(await configure(bob, kb, USDC))]);
  log("private send 2 TSLA to bob", await sendPrivate(alice, ka, TSLA, bob.address, 2n * 10n ** 8n));
  log("private send 1,500 USDC to bob", await sendPrivate(alice, ka, USDC, bob.address, 1_500n * 10n ** 6n));
  const bt = await balances(bob.address, kb, TSLA);
  const bu = await balances(bob.address, kb, USDC);
  check("bob received 2 TSLA (pending until applied)", bt.pending + bt.private === 2n * 10n ** 8n, `${fmt(bt.pending + bt.private, 8)}`);
  check("bob received 1,500 USDC", bu.pending + bu.private === 1_500n * 10n ** 6n);

  // 4. What anyone else sees.
  const raw = await fetchToken(rpc, await ataOf(bob.address, TSLA));
  check("a stranger reads bob's TSLA as 0 public", raw.data.amount === 0n, "the balance is a ciphertext");
  const wrong = await balances(bob.address, ka, TSLA).catch(() => undefined);
  check("alice's keys cannot read bob's balance", !wrong || wrong.private + wrong.pending !== 2n * 10n ** 8n);

  // 5-6. Unshield 5 TSLA and deposit them into Earn.
  log("unshield 5 TSLA", await unshield(alice, ka, TSLA, 8, 5n * 10n ** 8n));
  const earn = positionPda(aliceKp.publicKey, tsla.market, "earn");
  const sig = await ap.methods
    .earnDeposit(new BN(5e8), 2000)
    .accountsPartial({ user: aliceKp.publicKey, position: earn, ...rails("TSLA"), userStock: ata(aliceKp.publicKey, tsla.stockMint), tokenProgram: TOKEN_2022_PROGRAM_ID, systemProgram: SystemProgram.programId })
    .rpc();
  log("earn: deposit 5 TSLA at 20%", [sig]);
  a = await balances(alice.address, ka, TSLA);
  check("alice: 3 TSLA still private, 0 public", a.private === 3n * 10n ** 8n && a.public === 0n, `${fmt(a.private, 8)} private`);

  // 7. Close and shield what came back.
  log("earn: close", [
    await ap.methods
      .earnClose()
      .accountsPartial({ user: aliceKp.publicKey, position: earn, ...rails("TSLA"), userUsdc: ata(aliceKp.publicKey, usdcMint), userStock: ata(aliceKp.publicKey, tsla.stockMint), ...sys })
      .rpc(),
  ]);
  log("shield what came back", [...(await shield(alice, ka, TSLA, 8)), ...(await shield(alice, ka, USDC, 6))]);
  a = await balances(alice.address, ka, TSLA);
  au = await balances(alice.address, ka, USDC);
  check("alice: 8 TSLA private again, 0 public", a.private === 8n * 10n ** 8n && a.public === 0n, `${fmt(a.private, 8)} private`);
  check("alice: USDC public zero", au.public === 0n, `${fmt(au.private, 6)} private`);

  // 8. Bob takes USDC out of private and lends it.
  log("bob unshields 1,000 USDC", await unshield(bob, kb, USDC, 6, 1_000n * 10n ** 6n));
  const bp = programFor(bobKp, conn);
  log("bob supplies 1,000 USDC", [
    await bp.methods
      .supply(new BN(1_000e6))
      .accountsPartial({ user: bobKp.publicKey, protocol: protocolPda, usdcMint, lpMint, poolUsdc, userUsdc: ata(bobKp.publicKey, usdcMint), userLp: ata(bobKp.publicKey, lpMint), ...sys })
      .rpc(),
  ]);
  log("bob shields his LP token", await shield(bob, kb, toAddress(lpMint), 6));
  const blp = await balances(bob.address, kb, toAddress(lpMint));
  const bu2 = await balances(bob.address, kb, USDC);
  check("bob: LP private, public zero", blp.private > 0n && blp.public === 0n, `${fmt(blp.private, 6)} LP private`);
  check("bob: 500 USDC left private", bu2.private === 500n * 10n ** 6n, `${fmt(bu2.private, 6)}`);

  await sweep(conn, aliceKp, funder.publicKey);
  await sweep(conn, bobKp, funder.publicKey);
  console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

export { PublicKey };
