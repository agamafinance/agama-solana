// Confidential balances for every Agama token (USDC, the four stocks, the LP
// token), through Token-2022's confidential transfer extension and the
// official Kit client. Amounts in a private balance and in private transfers
// are ElGamal ciphertexts; the ZK proofs are built here and checked on chain
// by the ZK ElGamal proof program.
//
//   configure   add the encrypted balance to a token account (once per token)
//   shield      public balance -> private (deposit, then apply)
//   send        private -> someone else's private, amount hidden
//   unshield    private -> public (the amount is revealed, by design)
//   balances    decrypt with the owner's keys
//
// The keys are derived from one wallet signature over "solana-conf-bal/v1",
// the standard every Token-2022 client uses, so another wallet app derives the
// same keys and can read the same balances.
import fs from "fs";
import os from "os";
import {
  type Address,
  type KeyPairSigner,
  type TransactionSigner,
  address,
  appendTransactionMessageInstructions,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createTransactionMessage,
  createTransactionPlanExecutor,
  createTransactionPlanner,
  getBase64EncodedWireTransaction,
  getSignatureFromTransaction,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Instruction,
  type InstructionPlan,
  type TransactionMessage,
  type TransactionMessageWithFeePayer,
} from "@solana/kit";
import {
  TOKEN_2022_PROGRAM_ADDRESS,
  fetchToken,
  findAssociatedTokenPda,
  getConfidentialDepositInstruction,
} from "@solana-program/token-2022";
import {
  decryptConfidentialTransferBalance,
  deriveConfidentialKeys,
  getApplyConfidentialPendingBalanceInstructionFromToken,
  getConfidentialTransferInstructionPlan,
  getConfidentialWithdrawInstructionPlan,
  getCreateConfidentialTransferAccountInstructionPlan,
} from "@solana-program/token-2022/confidential";
import { AeKey, ElGamalKeypair, ElGamalSecretKey } from "@solana/zk-sdk";
import { RPC } from "./common";

export const rpc = createSolanaRpc(RPC);

export type Keys = { elgamal: ElGamalKeypair; secret: ElGamalSecretKey; ae: AeKey; pubkey: Address };

export async function keysFor(signer: KeyPairSigner): Promise<Keys> {
  const k = await deriveConfidentialKeys({ signer });
  const secret = ElGamalSecretKey.fromBytes(k.elgamalKeypair.secretKey);
  return { elgamal: ElGamalKeypair.fromSecretKey(secret), secret, ae: AeKey.fromBytes(k.aeKey), pubkey: k.elgamalKeypair.elgamalPubkey };
}

export async function kitSigner(file = `${os.homedir()}/.config/solana/id.json`): Promise<KeyPairSigner> {
  return createKeyPairSignerFromBytes(Uint8Array.from(JSON.parse(fs.readFileSync(file, "utf8"))));
}

export const kitSignerFromSecret = (secret: Uint8Array) => createKeyPairSignerFromBytes(secret);

export async function ataOf(owner: Address, mint: Address): Promise<Address> {
  return (await findAssociatedTokenPda({ owner, mint, tokenProgram: TOKEN_2022_PROGRAM_ADDRESS }))[0];
}

type Msg = TransactionMessage & TransactionMessageWithFeePayer;

/// Send one message and see it confirmed. Devnet RPCs drop transactions under
/// load, so the same signed bytes are re-sent every 2 s until the blockhash
/// expires; an expired one that never landed is signed again with a fresh
/// blockhash (at most three times). A landed transaction is never re-signed.
async function sendMessage(msg: Msg): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { value: bh } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
    const tx = await signTransactionMessageWithSigners(setTransactionMessageLifetimeUsingBlockhash(bh, msg) as any);
    const sig = getSignatureFromTransaction(tx);
    const wire = getBase64EncodedWireTransaction(tx);
    const send = () =>
      rpc.sendTransaction(wire, { encoding: "base64", preflightCommitment: "confirmed", maxRetries: 0n }).send();
    await send();
    for (;;) {
      await new Promise((r) => setTimeout(r, 2000));
      const { value } = await rpc.getSignatureStatuses([sig], { searchTransactionHistory: true }).send();
      const s = value[0];
      if (s?.err) throw new Error(`${sig} failed: ${JSON.stringify(s.err, (_, v) => (typeof v === "bigint" ? v.toString() : v))}`);
      if (s && (s.confirmationStatus === "confirmed" || s.confirmationStatus === "finalized")) return sig;
      const height = await rpc.getBlockHeight({ commitment: "confirmed" }).send();
      if (height > bh.lastValidBlockHeight) break;
      await send().catch(() => {});
    }
  }
  throw new Error("not confirmed after three blockhashes");
}

export async function sendIxs(payer: TransactionSigner, ixs: Instruction[]): Promise<string> {
  const msg = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(payer, m),
    (m) => appendTransactionMessageInstructions(ixs, m),
  );
  return sendMessage(msg as Msg);
}

/// Run a Kit instruction plan (the proof-carrying flows span several
/// transactions: proof context accounts, then the instruction that reads them).
export async function runPlan(payer: TransactionSigner, plan: InstructionPlan): Promise<string[]> {
  const planner = createTransactionPlanner({
    createTransactionMessage: () =>
      pipe(createTransactionMessage({ version: 0 }), (m) => setTransactionMessageFeePayerSigner(payer, m)),
  });
  const executor = createTransactionPlanExecutor({
    executeTransactionMessage: async (_ctx, msg) => ({ signature: (await sendMessage(msg)) as any }),
  });
  const result: any = await executor(await planner(plan));
  const sigs: string[] = [];
  const walk = (r: any) => (r.kind === "single" ? sigs.push(r.context?.signature) : (r.plans ?? []).forEach(walk));
  walk(result);
  return sigs;
}

export async function isConfigured(token: Address): Promise<boolean> {
  try {
    const acc = await fetchToken(rpc, token);
    return (acc.data.extensions as any)?.__option === "Some" && (acc.data.extensions as any).value.some((e: any) => e.__kind === "ConfidentialTransferAccount");
  } catch {
    return false;
  }
}

/// Add the encrypted balance to the owner's token account (creating the
/// account if needed). Idempotent.
export async function configure(owner: KeyPairSigner, keys: Keys, mint: Address): Promise<string[]> {
  const token = await ataOf(owner.address, mint);
  if (await isConfigured(token)) return [];
  return runPlan(
    owner,
    await getCreateConfidentialTransferAccountInstructionPlan({ payer: owner, owner, mint, rpc, elgamalKeypair: keys.elgamal, aesKey: keys.ae }),
  );
}

export async function applyPending(owner: KeyPairSigner, keys: Keys, mint: Address): Promise<string | undefined> {
  const token = await ataOf(owner.address, mint);
  const acc = await fetchToken(rpc, token);
  const b = decryptConfidentialTransferBalance({ tokenAccount: acc.data, elgamalSecretKey: keys.secret, aesKey: keys.ae });
  if (b.pendingBalance === 0n) return undefined;
  return sendIxs(owner, [
    getApplyConfidentialPendingBalanceInstructionFromToken({ token, tokenAccount: acc.data, authority: owner, elgamalSecretKey: keys.secret, aesKey: keys.ae }),
  ]);
}

/// Public -> private. `amount` defaults to the whole public balance.
export async function shield(owner: KeyPairSigner, keys: Keys, mint: Address, decimals: number, amount?: bigint): Promise<string[]> {
  const sigs = await configure(owner, keys, mint);
  const token = await ataOf(owner.address, mint);
  const pub = (await fetchToken(rpc, token)).data.amount;
  const amt = amount ?? pub;
  if (amt === 0n) return sigs;
  sigs.push(await sendIxs(owner, [getConfidentialDepositInstruction({ token, mint, authority: owner, amount: amt, decimals })]));
  const applied = await applyPending(owner, keys, mint);
  if (applied) sigs.push(applied);
  return sigs;
}

/// Private -> public, so the program can take it. The amount is public here.
export async function unshield(owner: KeyPairSigner, keys: Keys, mint: Address, decimals: number, amount: bigint): Promise<string[]> {
  const sigs: string[] = [];
  const applied = await applyPending(owner, keys, mint);
  if (applied) sigs.push(applied);
  const token = await ataOf(owner.address, mint);
  const acc = await fetchToken(rpc, token);
  sigs.push(
    ...(await runPlan(
      owner,
      await getConfidentialWithdrawInstructionPlan({ token, mint, tokenAccount: acc.data, authority: owner, amount, decimals, elgamalKeypair: keys.elgamal, aesKey: keys.ae, payer: owner, rpc }),
    )),
  );
  return sigs;
}

/// Private -> the recipient's private balance. Nobody but the two of them
/// learns the amount. The recipient's account must be configured.
export async function sendPrivate(owner: KeyPairSigner, keys: Keys, mint: Address, to: Address, amount: bigint): Promise<string[]> {
  const sigs: string[] = [];
  const applied = await applyPending(owner, keys, mint);
  if (applied) sigs.push(applied);
  const sourceToken = await ataOf(owner.address, mint);
  const destinationToken = await ataOf(to, mint);
  const src = await fetchToken(rpc, sourceToken);
  const dst = await fetchToken(rpc, destinationToken);
  sigs.push(
    ...(await runPlan(
      owner,
      await getConfidentialTransferInstructionPlan({
        sourceToken, mint, destinationToken, sourceTokenAccount: src.data, destinationTokenAccount: dst.data,
        authority: owner, amount, sourceElgamalKeypair: keys.elgamal, aesKey: keys.ae, payer: owner, rpc,
      }),
    )),
  );
  return sigs;
}

export type Balances = { public: bigint; private: bigint; pending: bigint; configured: boolean };

export async function balances(owner: Address, keys: Keys | undefined, mint: Address): Promise<Balances> {
  const token = await ataOf(owner, mint);
  let acc;
  try {
    acc = await fetchToken(rpc, token);
  } catch {
    return { public: 0n, private: 0n, pending: 0n, configured: false };
  }
  const configured = await isConfigured(token);
  if (!configured || !keys) return { public: acc.data.amount, private: 0n, pending: 0n, configured };
  const b = decryptConfidentialTransferBalance({ tokenAccount: acc.data, elgamalSecretKey: keys.secret, aesKey: keys.ae });
  return { public: acc.data.amount, private: b.availableBalance, pending: b.pendingBalance, configured };
}

export const toAddress = (k: { toBase58(): string }) => address(k.toBase58());
