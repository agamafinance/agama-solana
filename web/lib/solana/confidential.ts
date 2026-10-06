'use client';

// Confidential balances in the browser, for every Agama token: USDC, the four
// stocks and the LP token are Token-2022 mints with the confidential transfer
// extension. A balance moved into the confidential side is an ElGamal
// ciphertext only its owner can read; a private send hides the amount from
// everyone but the two parties. The ZK proofs are built here, with the
// official client (@solana-program/token-2022/confidential and @solana/zk-sdk),
// and checked on chain by the ZK ElGamal proof program.
//
// What stays public, by design: the program needs plain amounts to price a
// loan, so anything entering or leaving the protocol, and every position, is
// public state. The private side is what you hold and what you send.
//
// One wallet approval per action: every transaction an action needs is built
// first (proofs included), signed in one `signAllTransactions` when the wallet
// has it, then sent in order.
import {
  AccountRole,
  address,
  createNoopSigner,
  createSolanaRpc,
  createTransactionMessage,
  createTransactionPlanner,
  getBase64EncodedWireTransaction,
  partiallySignTransactionMessageWithSigners,
  pipe,
  appendTransactionMessageInstructions,
  sequentialInstructionPlan,
  singleInstructionPlan,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  type Address,
  type Instruction,
  type InstructionPlan,
  type TransactionSigner,
} from '@solana/kit';
import {
  getApplyConfidentialPendingBalanceInstruction,
  getConfidentialDepositInstruction,
  getTokenDecoder,
  type Token,
} from '@solana-program/token-2022';
import {
  decryptConfidentialTransferBalance,
  getConfidentialTransferInstructionPlan,
  getConfidentialWithdrawInstructionPlan,
  getCreateConfidentialTransferAccountInstructionPlan,
} from '@solana-program/token-2022/confidential';
import { AeKey, ConfidentialKeys, ElGamalKeypair, ElGamalSecretKey } from '@solana/zk-sdk';
import { PublicKey, VersionedTransaction, type Connection, type TransactionInstruction } from '@solana/web3.js';

import { ata, RPC } from './config';
import { PRIVATE_TOKENS, tokenByMint, type Balance, type Keys, type Progress } from './privateTokens';
import type { SolanaProvider } from './wallet';

export const kitRpc = createSolanaRpc(RPC);

export { PRIVATE_TOKENS, tokenByMint } from './privateTokens';
export type { Balance, Keys, PrivToken, Progress } from './privateTokens';

const kaddr = (k: PublicKey): Address => address(k.toBase58());

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

/// One signature over "solana-conf-bal/v1", the message every Token-2022
/// client signs, so any other wallet app derives the same keys. Kept in
/// memory for the session, never stored.
export async function unlockKeys(provider: SolanaProvider): Promise<Keys> {
  if (typeof provider.signMessage !== 'function') throw new Error('This wallet cannot sign a message');
  const out = await provider.signMessage(ConfidentialKeys.signerMessage());
  const sig: Uint8Array = out instanceof Uint8Array ? out : new Uint8Array(out?.signature ?? out);
  if (sig.length !== 64) throw new Error('The wallet returned no signature');
  const keys = ConfidentialKeys.fromSignature(sig);
  const elgamal = keys.elgamal();
  return { elgamal, secret: elgamal.secret(), ae: keys.ae() };
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

function ctExtension(t: Token): any | undefined {
  const ext = (t.extensions as any)?.__option === 'Some' ? (t.extensions as any).value : [];
  return ext.find((e: any) => e.__kind === 'ConfidentialTransferAccount');
}

export const decodeToken = (data: Uint8Array) => getTokenDecoder().decode(data) as Token;

/// Public and (if unlocked) private balances of every Agama token, in one call.
export async function readBalances(conn: Connection, owner: PublicKey, keys?: Keys): Promise<Balance[]> {
  const infos = await conn.getMultipleAccountsInfo(PRIVATE_TOKENS.map((t) => ata(owner, t.mint)));
  return PRIVATE_TOKENS.map((token, i) => {
    const info = infos[i];
    if (!info) return { token, exists: false, configured: false, public: 0n, private: keys ? 0n : undefined, pending: keys ? 0n : undefined };
    const t = decodeToken(info.data);
    const configured = !!ctExtension(t);
    if (!configured) return { token, exists: true, configured, public: t.amount, private: keys ? 0n : undefined, pending: keys ? 0n : undefined };
    if (!keys) return { token, exists: true, configured, public: t.amount };
    const b = decryptConfidentialTransferBalance({ tokenAccount: t, elgamalSecretKey: keys.secret, aesKey: keys.ae });
    return { token, exists: true, configured, public: t.amount, private: b.availableBalance, pending: b.pendingBalance };
  });
}

async function fetchTokenAccount(conn: Connection, owner: PublicKey, mint: PublicKey): Promise<Token | undefined> {
  const info = await conn.getAccountInfo(ata(owner, mint));
  return info ? decodeToken(info.data) : undefined;
}

// ---------------------------------------------------------------------------
// Batches: build everything, approve once, send in order
// ---------------------------------------------------------------------------

/// One step of a batch: either a Kit plan (the proof-carrying flows) or plain
/// instructions from the Anchor client, which go out as one transaction.
export type Step = { plan: InstructionPlan } | { ixs: TransactionInstruction[] };

function fromWeb3(ix: TransactionInstruction): Instruction {
  return {
    programAddress: kaddr(ix.programId),
    accounts: ix.keys.map((k) => ({
      address: kaddr(k.pubkey),
      role: k.isSigner
        ? k.isWritable ? AccountRole.WRITABLE_SIGNER : AccountRole.READONLY_SIGNER
        : k.isWritable ? AccountRole.WRITABLE : AccountRole.READONLY,
    })),
    data: new Uint8Array(ix.data),
  };
}

async function messagesFor(payer: TransactionSigner, steps: Step[]) {
  const base = () => pipe(createTransactionMessage({ version: 0 }), (m) => setTransactionMessageFeePayerSigner(payer, m));
  const planner = createTransactionPlanner({ createTransactionMessage: base });
  const out: any[] = [];
  const walk = (p: any) => (p.kind === 'single' ? out.push(p.message) : (p.plans ?? []).forEach(walk));
  for (const step of steps) {
    if ('ixs' in step) {
      if (step.ixs.length) out.push(appendTransactionMessageInstructions(step.ixs.map(fromWeb3), base()));
    } else {
      walk(await planner(step.plan));
    }
  }
  return out;
}

/// Build, approve once, send one by one. Returns every signature, in order.
export async function runBatch(
  provider: SolanaProvider,
  conn: Connection,
  owner: PublicKey,
  steps: Step[],
  progress: Progress = () => {},
): Promise<string[]> {
  const payer = createNoopSigner(kaddr(owner));
  const msgs = await messagesFor(payer, steps);
  if (msgs.length === 0) return [];
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('confirmed');
  const lifetime = { blockhash: blockhash as any, lastValidBlockHeight: BigInt(lastValidBlockHeight) };
  const vtxs: VersionedTransaction[] = [];
  for (const m of msgs) {
    // Proof context accounts carry their own throwaway signers; the wallet
    // is a placeholder here and signs below.
    const tx = await partiallySignTransactionMessageWithSigners(setTransactionMessageLifetimeUsingBlockhash(lifetime, m) as any);
    vtxs.push(VersionedTransaction.deserialize(Buffer.from(getBase64EncodedWireTransaction(tx), 'base64')));
  }
  progress(`Approve ${vtxs.length} transaction${vtxs.length > 1 ? 's' : ''} in the wallet...`);
  let signed: any[];
  if (typeof provider.signAllTransactions === 'function') signed = await provider.signAllTransactions(vtxs);
  else {
    signed = [];
    for (const v of vtxs) signed.push(await provider.signTransaction(v));
  }
  const sigs: string[] = [];
  for (let i = 0; i < signed.length; i++) {
    progress(`Sending ${i + 1} of ${signed.length}...`);
    const raw = signed[i].serialize();
    const sig = await conn.sendRawTransaction(raw, { skipPreflight: false, preflightCommitment: 'confirmed', maxRetries: 0 });
    await confirm(conn, sig, raw, lastValidBlockHeight);
    sigs.push(sig);
  }
  return sigs;
}

/// Devnet RPCs drop transactions under load: re-send the same signed bytes
/// every 2 s until it lands or its blockhash expires. Nothing is re-signed, so
/// the wallet is asked once.
async function confirm(conn: Connection, sig: string, raw: Uint8Array, lastValidBlockHeight: number) {
  for (;;) {
    await new Promise((r) => setTimeout(r, 2000));
    const { value } = await conn.getSignatureStatuses([sig], { searchTransactionHistory: true });
    const st = value[0];
    if (st?.err) throw new Error(`Transaction failed: ${JSON.stringify(st.err)}`);
    if (st?.confirmationStatus === 'confirmed' || st?.confirmationStatus === 'finalized') return;
    if ((await conn.getBlockHeight('confirmed')) > lastValidBlockHeight) {
      throw new Error(`Expired before landing, nothing was spent: ${sig}`);
    }
    await conn.sendRawTransaction(raw, { skipPreflight: true, maxRetries: 0 }).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// The steps
// ---------------------------------------------------------------------------

/// Public -> private, for any number of tokens. Adds the encrypted balance to
/// accounts that do not have one yet, then deposit and apply in one go: the
/// new readable balance is computed here, so the apply does not have to wait
/// for the deposit to land.
export async function shieldSteps(
  conn: Connection,
  owner: PublicKey,
  keys: Keys,
  items: { mint: PublicKey; amount: bigint }[],
): Promise<Step[]> {
  const payer = createNoopSigner(kaddr(owner));
  const plans: Step[] = [];
  const ixs: Instruction[] = [];
  for (const { mint, amount } of items) {
    if (amount <= 0n) continue;
    const { decimals } = tokenByMint(mint);
    const t = await fetchTokenAccount(conn, owner, mint);
    let available = 0n;
    let pending = 0n;
    let counter = 0n;
    if (!t || !ctExtension(t)) {
      plans.push({
        plan: await getCreateConfidentialTransferAccountInstructionPlan({
          payer, owner: payer, mint: kaddr(mint), rpc: kitRpc as any, elgamalKeypair: keys.elgamal, aesKey: keys.ae,
        }),
      });
    } else {
      const b = decryptConfidentialTransferBalance({ tokenAccount: t, elgamalSecretKey: keys.secret, aesKey: keys.ae });
      available = b.availableBalance;
      pending = b.pendingBalance;
      counter = BigInt(ctExtension(t).pendingBalanceCreditCounter);
    }
    const token = kaddr(ata(owner, mint));
    ixs.push(getConfidentialDepositInstruction({ token, mint: kaddr(mint), authority: payer, amount, decimals }));
    ixs.push(
      getApplyConfidentialPendingBalanceInstruction({
        token,
        authority: payer,
        expectedPendingBalanceCreditCounter: counter + 1n,
        newDecryptableAvailableBalance: keys.ae.encrypt(available + pending + amount).toBytes(),
      }),
    );
  }
  // Deposits and applies pack together, as many per transaction as fit.
  if (ixs.length) plans.push({ plan: sequentialInstructionPlan(ixs) });
  return plans;
}

/// Fold incoming private sends into the readable balance. Needed before an
/// unshield or a send: their proofs are made against the available balance.
export async function applySteps(conn: Connection, owner: PublicKey, keys: Keys, mint: PublicKey): Promise<Step[]> {
  const t = await fetchTokenAccount(conn, owner, mint);
  if (!t || !ctExtension(t)) return [];
  const b = decryptConfidentialTransferBalance({ tokenAccount: t, elgamalSecretKey: keys.secret, aesKey: keys.ae });
  if (b.pendingBalance === 0n) return [];
  const payer = createNoopSigner(kaddr(owner));
  return [
    {
      plan: singleInstructionPlan(
        getApplyConfidentialPendingBalanceInstruction({
          token: kaddr(ata(owner, mint)),
          authority: payer,
          expectedPendingBalanceCreditCounter: BigInt(ctExtension(t).pendingBalanceCreditCounter),
          newDecryptableAvailableBalance: keys.ae.encrypt(b.availableBalance + b.pendingBalance).toBytes(),
        }),
      ),
    },
  ];
}

/// Private -> public. The amount is public from here: the program has to see it.
export async function unshieldSteps(conn: Connection, owner: PublicKey, keys: Keys, mint: PublicKey, amount: bigint): Promise<Step[]> {
  const t = await fetchTokenAccount(conn, owner, mint);
  if (!t || !ctExtension(t)) throw new Error('No private balance for this token yet');
  const payer = createNoopSigner(kaddr(owner));
  return [
    {
      plan: await getConfidentialWithdrawInstructionPlan({
        token: kaddr(ata(owner, mint)), mint: kaddr(mint), tokenAccount: t, authority: payer, amount,
        decimals: tokenByMint(mint).decimals, elgamalKeypair: keys.elgamal, aesKey: keys.ae, payer, rpc: kitRpc as any,
      }),
    },
  ];
}

export class RecipientNotReady extends Error {}

/// Private -> the recipient's private balance, amount hidden.
export async function sendSteps(conn: Connection, owner: PublicKey, keys: Keys, mint: PublicKey, to: PublicKey, amount: bigint): Promise<Step[]> {
  const src = await fetchTokenAccount(conn, owner, mint);
  if (!src || !ctExtension(src)) throw new Error('No private balance for this token yet');
  const dst = await fetchTokenAccount(conn, to, mint);
  if (!dst || !ctExtension(dst)) {
    throw new RecipientNotReady(`This address has not set up a private ${tokenByMint(mint).label} balance yet. They open the Private tab and shield any amount once.`);
  }
  const payer = createNoopSigner(kaddr(owner));
  return [
    {
      plan: await getConfidentialTransferInstructionPlan({
        sourceToken: kaddr(ata(owner, mint)), mint: kaddr(mint), destinationToken: kaddr(ata(to, mint)),
        sourceTokenAccount: src, destinationTokenAccount: dst, authority: payer, amount,
        sourceElgamalKeypair: keys.elgamal, aesKey: keys.ae, payer, rpc: kitRpc as any,
      }),
    },
  ];
}

/// How many transactions a list of steps turns into, without sending them.
export async function countTxs(owner: PublicKey, steps: Step[]): Promise<number> {
  return (await messagesFor(createNoopSigner(kaddr(owner)), steps)).length;
}
