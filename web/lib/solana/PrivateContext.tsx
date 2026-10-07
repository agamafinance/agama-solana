'use client';

// Private by default. Every Agama token is a confidential Token-2022 token and
// a holder's tokens live in the confidential balance: the faucet shields what
// it mints, a deposit unshields exactly what the public side lacks, a close
// shields exactly what came back.
//
// One action at a time, app-wide: a confidential balance carries a client-
// written copy of the readable balance, and two actions built from the same
// read would write it twice from stale data and strand the balance. Every
// action takes the lock, re-reads the accounts, then builds.

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { PublicKey, TransactionInstruction } from '@solana/web3.js';

import { countTxs, PartialFailure, runBatch, type Progress, type Step } from './batch';
import { useSolanaWallet } from './WalletProvider';
import { connection } from './useSolana';
import { tokenByMint, type Balance, type Keys } from './privateTokens';

/// The proof code and its WASM load in the browser only, on first use.
const lib = () => import('./confidential');

/// What an action left public when it stopped part way, so the page can offer
/// to shield it back in one click.
export type PublicLeft = { mint: PublicKey; amount: bigint };

export class PrivateActionError extends Error {
  constructor(message: string, readonly publicLeft?: PublicLeft[]) {
    super(message);
  }
}

type Ctx = {
  keys?: Keys;
  unlocked: boolean;
  unlocking: boolean;
  /// One signature over the standard message; asked once per session.
  unlock: () => Promise<Keys>;
  lock: () => void;
  /// True while an action holds the lock, anywhere in the app.
  busy: boolean;
  balances?: Balance[];
  balancesAt?: number;
  balancesError: string;
  refresh: () => void;
  /// Private balance (available plus incoming); 0 while locked.
  privateOf: (mint: PublicKey) => bigint;
  publicOf: (mint: PublicKey) => bigint;
  /// Unshield what the public side lacks for `spend`, run the program
  /// instructions, then shield exactly what `returns` brought back.
  act: (o: {
    label: string;
    spend?: { mint: PublicKey; amount: bigint };
    ixs: () => Promise<TransactionInstruction[]>;
    returns?: PublicKey[];
    progress?: Progress;
  }) => Promise<string[]>;
  /// Mint (the faucet) and shield what was minted, in one approval.
  mintPrivately: (o: {
    ixGroups: TransactionInstruction[][];
    minted: { mint: PublicKey; amount: bigint }[];
    progress?: Progress;
  }) => Promise<string[]>;
  shield: (items: PublicLeft[], progress?: Progress) => Promise<string[]>;
};

const C = createContext<Ctx>(null as unknown as Ctx);
const SIG_KEY = 'agama.conf-sig.';

export function PrivateProvider({ children }: { children: ReactNode }) {
  const { address, provider } = useSolanaWallet();
  const [keys, setKeys] = useState<Keys>();
  const keysRef = useRef<Keys | undefined>(undefined);
  const [unlocking, setUnlocking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [balances, setBalances] = useState<Balance[]>();
  const [balancesAt, setBalancesAt] = useState<number>();
  const [balancesError, setBalancesError] = useState('');
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const lockChain = useRef<Promise<unknown>>(Promise.resolve());
  const key = address?.toBase58();

  // A different wallet or account, different keys: never carry them across.
  // The signature that derives them is kept for this tab's session only
  // (sessionStorage, read-only keys: they read balances, never spend), so
  // connecting asks for it once and a reload does not ask again.
  const asked = useRef<string | undefined>(undefined);
  useEffect(() => {
    keysRef.current = undefined;
    setKeys(undefined);
    setBalances(undefined);
    setBalancesAt(undefined);
    if (!key) return;
    const saved = sessionStorage.getItem(SIG_KEY + key);
    if (saved) {
      lib()
        .then((c) => {
          const k = c.keysFromSignature(Uint8Array.from(atob(saved), (ch) => ch.charCodeAt(0)));
          keysRef.current = k;
          setKeys(k);
        })
        .catch(() => sessionStorage.removeItem(SIG_KEY + key));
    }
  }, [key]);

  // Balances every 15 s, backing off to 2 min while the RPC is failing.
  useEffect(() => {
    if (!address) return;
    let alive = true;
    let wait = 15_000;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const b = await (await lib()).readBalances(connection, address, keys);
        if (!alive) return;
        setBalances(b);
        setBalancesAt(Date.now());
        setBalancesError('');
        wait = 15_000;
      } catch (e: any) {
        if (!alive) return;
        setBalancesError(String(e?.message ?? e).slice(0, 120));
        wait = Math.min(wait * 2, 120_000);
      }
      if (alive) timer = setTimeout(load, wait);
    };
    load();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, keys, tick]);

  const unlock = useCallback(async () => {
    if (keysRef.current) return keysRef.current;
    if (!provider) throw new Error('Connect a wallet first');
    setUnlocking(true);
    try {
      const { keys: k, signature } = await (await lib()).unlockKeys(provider);
      if (key) sessionStorage.setItem(SIG_KEY + key, btoa(String.fromCharCode(...signature)));
      keysRef.current = k;
      setKeys(k);
      return k;
    } finally {
      setUnlocking(false);
    }
  }, [provider, key]);

  // Native: right after the wallet connects, ask once for the signature that
  // reads the private balances. Cancelled, the bar keeps a way to ask again.
  useEffect(() => {
    if (!key || !provider || keysRef.current || asked.current === key) return;
    if (sessionStorage.getItem(SIG_KEY + key)) return;
    asked.current = key;
    const t = setTimeout(() => unlock().catch(() => {}), 400);
    return () => clearTimeout(t);
  }, [key, provider, unlock]);

  /// Unlock with a word of explanation first: the wallet is about to show a
  /// raw signing request, and the status line should say what it is for.
  const unlockWith = useCallback(
    (progress?: (text: string) => void) => {
      if (!keysRef.current)
        progress?.('Sign once in the wallet to unlock your private balances: it lets this app read them, never spend them.');
      return unlock();
    },
    [unlock],
  );

  const lock = useCallback(() => {
    if (key) sessionStorage.removeItem(SIG_KEY + key);
    keysRef.current = undefined;
    setKeys(undefined);
  }, [key]);

  const withLock = useCallback(<T,>(f: () => Promise<T>): Promise<T> => {
    const run = lockChain.current.then(async () => {
      setBusy(true);
      try {
        return await f();
      } finally {
        setBusy(false);
      }
    });
    lockChain.current = run.catch(() => {});
    return run;
  }, []);

  const privateOf = useCallback(
    (mint: PublicKey) => {
      const b = balances?.find((x) => x.token.mint.equals(mint));
      return (b?.private ?? 0n) + (b?.pending ?? 0n);
    },
    [balances],
  );
  const publicOf = useCallback(
    (mint: PublicKey) => balances?.find((x) => x.token.mint.equals(mint))?.public ?? 0n,
    [balances],
  );

  const need = useCallback(() => {
    if (!address || !provider) throw new Error('Connect a wallet first');
    return { address, provider };
  }, [address, provider]);

  const shieldNow = useCallback(
    async (k: Keys, items: PublicLeft[], progress?: Progress) => {
      const { address, provider } = need();
      const c = await lib();
      const steps = await c.shieldSteps(connection, address, k, items.filter((i) => i.amount > 0n));
      return steps.length ? runBatch(provider, connection, address, steps, progress) : [];
    },
    [need],
  );

  const shield = useCallback<Ctx['shield']>(
    (items, progress) =>
      withLock(async () => {
        try {
          return await shieldNow(await unlockWith(progress), items, progress);
        } finally {
          refresh();
        }
      }),
    [withLock, shieldNow, unlockWith, refresh],
  );

  const act = useCallback<Ctx['act']>(
    ({ label, spend, ixs, returns, progress }) =>
      withLock(async () => {
        const { address, provider } = need();
        try {
          const c = await lib();
          // Keys only when the action touches the private side: an unshield
          // before, or a shield after. Moving the slider needs none.
          const spendsPublicOnly = !spend || spend.amount === 0n;
          let k = keysRef.current;
          // Fresh read under the lock: the proofs are built against it.
          let before = await c.readBalances(connection, address, k);
          const bal = (m: PublicKey) => before.find((b) => b.token.mint.equals(m));

          const steps: Step[] = [];
          let fromPrivate = 0n;
          if (!spendsPublicOnly) {
            const pub = bal(spend!.mint)?.public ?? 0n;
            fromPrivate = spend!.amount > pub ? spend!.amount - pub : 0n;
            if (fromPrivate > 0n) {
              if (!k) {
                k = await unlockWith(progress);
                before = await c.readBalances(connection, address, k);
              }
              const b = bal(spend!.mint);
              const avail = b?.private ?? 0n;
              const pending = b?.pending ?? 0n;
              if (avail + pending < fromPrivate) {
                const t = tokenByMint(spend!.mint);
                throw new Error(`Not enough ${t.label}: you hold ${fmt(pub + avail + pending, t.decimals)}. See the Faucet.`);
              }
              if (avail < fromPrivate && pending > 0n) {
                // Incoming private transfers first: the withdraw proof is made
                // against the readable balance.
                progress?.('Folding in incoming private transfers...');
                await runBatch(provider, connection, address, await c.applySteps(connection, address, k, spend!.mint), progress);
              }
              progress?.('Building the proofs...');
              steps.push(...(await c.unshieldSteps(connection, address, k, spend!.mint, fromPrivate)));
            }
          }
          if (returns?.length && !k) {
            k = await unlockWith(progress);
            before = await c.readBalances(connection, address, k);
          }
          const unshieldTxs = steps.length ? await countTxs(address, steps) : 0;
          steps.push({ ixs: await ixs(), label });

          let sigs: string[];
          try {
            sigs = await runBatch(provider, connection, address, steps, progress);
          } catch (e) {
            if (e instanceof PartialFailure && fromPrivate > 0n && e.landed.length >= unshieldTxs) {
              const t = tokenByMint(spend!.mint);
              throw new PrivateActionError(
                `${e.cause}. The unshield went through, so ${fmt(fromPrivate, t.decimals)} ${t.label} is now public: shield it back.`,
                [{ mint: spend!.mint, amount: fromPrivate }],
              );
            }
            throw e;
          }

          if (returns?.length) {
            const after = await c.readBalances(connection, address, k);
            const items = returns
              .map((mint) => {
                const was = bal(mint)?.public ?? 0n;
                const now = after.find((b) => b.token.mint.equals(mint))?.public ?? 0n;
                return { mint, amount: now > was ? now - was : 0n };
              })
              .filter((i) => i.amount > 0n);
            if (items.length) {
              progress?.('Returning it to your private balance...');
              try {
                sigs.push(...(await shieldNow(k!, items, progress)));
              } catch (e) {
                const what = items.map((i) => `${fmt(i.amount, tokenByMint(i.mint).decimals)} ${tokenByMint(i.mint).label}`).join(' and ');
                throw new PrivateActionError(
                  `The ${label} went through, but returning ${what} to your private balance stopped (${e instanceof Error ? e.message : String(e)}). It is public now: shield it back.`,
                  items,
                );
              }
            }
          }
          return sigs;
        } finally {
          refresh();
        }
      }),
    [withLock, need, unlockWith, shieldNow, refresh],
  );

  const mintPrivately = useCallback<Ctx['mintPrivately']>(
    ({ ixGroups, minted, progress }) =>
      withLock(async () => {
        const { address, provider } = need();
        try {
          const k = await unlockWith(progress);
          const c = await lib();
          progress?.('Building the proofs...');
          // Built before the mint lands: minting only touches the public side,
          // so the encrypted state read now is still right when they execute.
          const shieldSteps = await c.shieldSteps(connection, address, k, minted);
          // One approval for everything: the mints, then the private setup.
          const steps: Step[] = [...ixGroups.map((ixs) => ({ ixs, label: 'mint' })), ...shieldSteps];
          try {
            return await runBatch(provider, connection, address, steps, progress);
          } catch (e) {
            if (e instanceof PartialFailure && e.landed.length >= ixGroups.length) {
              throw new PrivateActionError(`${e.cause}. The tokens were minted but not all shielded: shield them below.`, minted);
            }
            throw e;
          }
        } finally {
          refresh();
        }
      }),
    [withLock, need, unlockWith, refresh],
  );

  return (
    <C.Provider
      value={{
        keys, unlocked: !!keys, unlocking, unlock, lock, busy, balances, balancesAt, balancesError, refresh,
        privateOf, publicOf, act, mintPrivately, shield,
      }}
    >
      {children}
    </C.Provider>
  );
}

const fmt = (v: bigint, decimals: number) =>
  (Number(v) / 10 ** decimals).toLocaleString('en-US', { maximumFractionDigits: decimals === 6 ? 2 : 4 });

export const usePrivate = () => useContext(C);
