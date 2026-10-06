'use client';

// Confidential balances in the browser, for every Agama token: USDC, the
// stocks and gold (XAUt0) are Token-2022 mints with the confidential transfer
// extension. A balance moved into the confidential side is an ElGamal
// ciphertext only its owner can read; a private send hides the amount from
// everyone but the two parties. The ZK proofs are built here, with the
// official client (@solana-program/token-2022/confidential and @solana/zk-sdk),
// and checked on chain by the ZK ElGamal proof program.
//
// Private by default: what a holder keeps sits in the confidential balance.
// What stays public, by design: the program needs plain amounts to price a
// loan, so the amount entering or leaving the protocol, and every position,
// is public state.
//
// Every transaction an action needs is built first (proofs included) and goes
// through batch.ts: one approval, sent in order.
import {
  address,
  createNoopSigner,
  createSolanaRpc,
  sequentialInstructionPlan,
  singleInstructionPlan,
  type Address,
  type Instruction,
} from '@solana/kit';
import {
  getApplyConfidentialPendingBalanceInstruction,
  getConfidentialDepositInstruction,
  getTokenDecoder,
  type Token,
} from '@solana-program/token-2022';
import {
  decryptConfidentialTransferBalance,
  getConfidentialWithdrawInstructionPlan,
  getCreateConfidentialTransferAccountInstructionPlan,
} from '@solana-program/token-2022/confidential';
import { ConfidentialKeys } from '@solana/zk-sdk';
import { PublicKey, type Connection } from '@solana/web3.js';

import type { Step } from './batch';
import { ata, RPC } from './config';
import { PRIVATE_TOKENS, tokenByMint, type Balance, type Keys } from './privateTokens';
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
        label: `set up the private ${tokenByMint(mint).label} balance`,
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
  if (ixs.length) plans.push({ label: 'shield', plan: sequentialInstructionPlan(ixs) });
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
      label: 'fold in incoming',
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
      label: `unshield ${tokenByMint(mint).label}`,
      plan: await getConfidentialWithdrawInstructionPlan({
        token: kaddr(ata(owner, mint)), mint: kaddr(mint), tokenAccount: t, authority: payer, amount,
        decimals: tokenByMint(mint).decimals, elgamalKeypair: keys.elgamal, aesKey: keys.ae, payer, rpc: kitRpc as any,
      }),
    },
  ];
}
