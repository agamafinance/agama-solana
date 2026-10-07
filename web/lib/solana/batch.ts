'use client';

// Every transaction the app sends goes through here: build them all, approve
// once, send in order, see each one confirmed.
//
// What devnet does to a batch, and what this does about it:
// - RPCs drop transactions under load: the same signed bytes are re-sent every
//   couple of seconds until they land.
// - RPC calls fail (429s, timeouts): retried with backoff inside the loop, a
//   failed status read is not a failed transaction.
// - A batch outlives its blockhash (a five-transaction private send can): the
//   status is read once more, and whatever has not landed is signed again with
//   a fresh blockhash (one more approval) instead of being abandoned. Proof
//   context accounts the earlier part opened are closed by the later part, so
//   carrying on is what cleans them up.
// - A transaction fails on chain: the batch stops there, and the error says
//   which step it was and what had already landed. It never claims nothing was
//   spent when something was.
import {
  AccountRole,
  address,
  appendTransactionMessageInstructions,
  createNoopSigner,
  createTransactionMessage,
  createTransactionPlanner,
  getBase64EncodedWireTransaction,
  partiallySignTransactionMessageWithSigners,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  type Address,
  type Instruction,
  type InstructionPlan,
  type TransactionSigner,
} from '@solana/kit';
import { PublicKey, VersionedTransaction, type Connection, type TransactionInstruction } from '@solana/web3.js';

import type { SolanaProvider } from './wallet';

export type Progress = (text: string) => void;

/// One step of a batch: a Kit plan (the proof-carrying flows) or plain
/// instructions from the Anchor client, which go out as one transaction.
export type Step = { plan: InstructionPlan; label?: string } | { ixs: TransactionInstruction[]; label?: string };

/// A batch that stopped part way. `landed` already happened on chain.
export class PartialFailure extends Error {
  constructor(
    readonly landed: string[],
    readonly failedAt: number,
    readonly total: number,
    readonly cause: string,
    readonly stepLabel?: string,
  ) {
    super(
      landed.length === 0
        ? cause
        : `Stopped at transaction ${failedAt + 1} of ${total}${stepLabel ? ` (${stepLabel})` : ''}: ${cause}. ` +
            `${landed.length} transaction${landed.length > 1 ? 's' : ''} before it landed.`,
    );
  }
}

const kaddr = (k: PublicKey): Address => address(k.toBase58());
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

/// The transaction messages a list of steps turns into, each tagged with the
/// label of the step it came from.
async function messagesFor(payer: TransactionSigner, steps: Step[]) {
  const base = () => pipe(createTransactionMessage({ version: 0 }), (m) => setTransactionMessageFeePayerSigner(payer, m));
  const planner = createTransactionPlanner({ createTransactionMessage: base });
  const out: { msg: any; label?: string }[] = [];
  for (const step of steps) {
    if ('ixs' in step) {
      if (step.ixs.length) out.push({ msg: appendTransactionMessageInstructions(step.ixs.map(fromWeb3), base()), label: step.label });
    } else {
      const walk = (p: any) => (p.kind === 'single' ? out.push({ msg: p.message, label: step.label }) : (p.plans ?? []).forEach(walk));
      walk(await planner(step.plan));
    }
  }
  return out;
}

/// How many transactions a list of steps turns into, without sending them.
export async function countTxs(owner: PublicKey, steps: Step[]): Promise<number> {
  return (await messagesFor(createNoopSigner(kaddr(owner)), steps)).length;
}

/// RPC call with retries: a 429 or a timeout is not an answer.
async function withRetry<T>(f: () => Promise<T>, tries = 6): Promise<T> {
  let wait = 1000;
  for (let i = 0; ; i++) {
    try {
      return await f();
    } catch (e) {
      if (i >= tries - 1) throw e;
      await sleep(wait);
      wait = Math.min(wait * 2, 8000);
    }
  }
}

type Outcome = { kind: 'landed' } | { kind: 'expired' } | { kind: 'failed'; error: string };

async function statusOf(conn: Connection, sig: string) {
  return (await withRetry(() => conn.getSignatureStatuses([sig], { searchTransactionHistory: true }))).value[0];
}

/// Send one signed transaction and follow it to an outcome.
async function follow(conn: Connection, sig: string, raw: Uint8Array, lastValidBlockHeight: number): Promise<Outcome> {
  for (;;) {
    await sleep(2000);
    let st;
    try {
      st = await statusOf(conn, sig);
    } catch {
      continue; // the RPC is struggling, not the transaction
    }
    if (st?.err) return { kind: 'failed', error: JSON.stringify(st.err) };
    if (st?.confirmationStatus === 'confirmed' || st?.confirmationStatus === 'finalized') return { kind: 'landed' };
    let height: number;
    try {
      height = await conn.getBlockHeight('confirmed');
    } catch {
      continue;
    }
    if (height > lastValidBlockHeight) {
      // It may have landed between the two reads: look once more before
      // calling it expired.
      const last = await statusOf(conn, sig).catch(() => null);
      if (last?.err) return { kind: 'failed', error: JSON.stringify(last.err) };
      if (last?.confirmationStatus === 'confirmed' || last?.confirmationStatus === 'finalized') return { kind: 'landed' };
      return { kind: 'expired' };
    }
    await conn.sendRawTransaction(raw, { skipPreflight: true, maxRetries: 0 }).catch(() => {});
  }
}

/// Sign the given messages with one wallet approval, after the throwaway proof
/// signers have signed their part.
async function signAll(provider: SolanaProvider, msgs: any[], lifetime: any): Promise<VersionedTransaction[]> {
  const vtxs: VersionedTransaction[] = [];
  for (const m of msgs) {
    const tx = await partiallySignTransactionMessageWithSigners(setTransactionMessageLifetimeUsingBlockhash(lifetime, m) as any);
    vtxs.push(VersionedTransaction.deserialize(Buffer.from(getBase64EncodedWireTransaction(tx), 'base64')));
  }
  if (typeof provider.signAllTransactions === 'function') return provider.signAllTransactions(vtxs);
  const out: VersionedTransaction[] = [];
  // One at a time: parallel requests open several wallet pop-ups at once.
  for (const v of vtxs) out.push(await provider.signTransaction!(v));
  return out;
}

/// Build, approve once, send in order. Returns every signature, in order.
export async function runBatch(
  provider: SolanaProvider,
  conn: Connection,
  owner: PublicKey,
  steps: Step[],
  progress: Progress = () => {},
): Promise<string[]> {
  if (typeof provider.signTransaction !== 'function' && typeof provider.signAllTransactions !== 'function') {
    throw new Error('This wallet cannot sign a transaction without also submitting it');
  }
  const all = await messagesFor(createNoopSigner(kaddr(owner)), steps);
  const landed: string[] = [];
  let next = 0;
  for (let round = 0; next < all.length; round++) {
    if (round >= 3) throw new PartialFailure(landed, next, all.length, 'the network kept dropping it', all[next].label);
    const { blockhash, lastValidBlockHeight } = await withRetry(() => conn.getLatestBlockhash('confirmed'));
    const lifetime = { blockhash: blockhash as any, lastValidBlockHeight: BigInt(lastValidBlockHeight) };
    const remaining = all.slice(next);
    const n = remaining.length;
    progress(
      round === 0
        ? `Approve ${n} transaction${n > 1 ? 's' : ''} in the wallet...`
        : `The network was slow: approve the ${n} remaining transaction${n > 1 ? 's' : ''} again...`,
    );
    const signed = await signAll(provider, remaining.map((r) => r.msg), lifetime);
    let expired = false;
    for (let i = 0; i < signed.length; i++) {
      const at = next;
      progress(`Sending ${at + 1} of ${all.length}...`);
      const raw = signed[i].serialize();
      let sig: string | undefined;
      // Devnet RPCs are load balanced: the preflight can land on a node that
      // has not seen the previous transaction of this batch yet, and fail with
      // no logs. A failure that does not reproduce on a second simulation is
      // that, and the send is tried again; one that does is a real error.
      for (let attempt = 0; !sig; attempt++) {
        try {
          sig = await conn.sendRawTransaction(raw, { skipPreflight: false, preflightCommitment: 'confirmed', maxRetries: 0 });
        } catch (e) {
          await sleep(2000 * (attempt + 1));
          const sim = await conn.simulateTransaction(signed[i], { sigVerify: false, commitment: 'confirmed' }).catch(() => null);
          const err = sim?.value.err ? JSON.stringify(sim.value.err) : '';
          if (err || attempt >= 3) {
            // The RPC's own answer, unfiltered by the client library.
            const rawAnswer = await fetch((conn as any).rpcEndpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'sendTransaction', params: [Buffer.from(raw).toString('base64'), { encoding: 'base64', preflightCommitment: 'confirmed' }] }),
            }).then((r) => r.text()).catch((x) => String(x));
            console.error('send failed', all[at].label, err, sim?.value.logs?.slice(-6), rawAnswer.slice(0, 600), 'size', raw.length);
            throw new PartialFailure(landed, at, all.length, err ? `${errorOf(e)} (${err})` : errorOf(e), all[at].label);
          }
        }
      }
      const o = await follow(conn, sig, raw, lastValidBlockHeight);
      if (o.kind === 'failed') throw new PartialFailure(landed, at, all.length, o.error, all[at].label);
      if (o.kind === 'expired') {
        expired = true;
        break;
      }
      landed.push(sig);
      next++;
    }
    if (!expired) break;
  }
  return landed;
}

/// The most useful line of a send error: the program's own message, or the
/// failing log line, rather than "Simulation failed".
function errorOf(e: unknown): string {
  const any = e as { message?: string; logs?: string[]; transactionMessage?: string };
  const msg = any?.message ?? String(e);
  const logs: string[] = any?.logs ?? [];
  const text = [msg, any?.transactionMessage ?? '', ...logs].join('\n');
  const anchor = text.match(/Error Message: ([^.\n]+)/);
  if (anchor) return anchor[1];
  if (/insufficient (funds|lamports)|no record of a prior credit|0x1\b/i.test(text)) return 'This wallet has no SOL on devnet to pay fees. Get some at faucet.solana.com, then try again.';
  const log = logs.find((l) => /Error|failed|insufficient/i.test(l) && !/consumed/.test(l));
  if (log) return log.replace(/^Program log: /, '').slice(0, 200);
  const tm = any?.transactionMessage?.split('\n').find((l) => l.trim().length > 0);
  return (tm || msg.split('\n').find((l) => l.trim().replace(/\.$/, '') !== 'Simulation failed') || msg).trim().slice(0, 200);
}
