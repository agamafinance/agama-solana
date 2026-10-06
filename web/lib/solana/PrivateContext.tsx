'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { PublicKey, TransactionInstruction } from '@solana/web3.js';

import { useSolanaWallet } from './WalletProvider';
import { connection } from './useSolana';
import type { Balance, Keys, Progress } from './privateTokens';
import type { Step } from './confidential';

/// The proof code and its WASM load in the browser only, on first use.
const lib = () => import('./confidential');

type Ctx = {
  keys?: Keys;
  unlocked: boolean;
  unlocking: boolean;
  unlock: () => Promise<void>;
  balances?: Balance[];
  refresh: () => void;
  /// Private balance usable right now (available plus incoming), 0 while locked.
  privateOf: (mint: PublicKey) => bigint;
  /// Unshield what is missing, run the program instructions, shield what came
  /// back. Each stage is one wallet approval; returns every signature.
  execute: (o: {
    unshield?: { mint: PublicKey; amount: bigint };
    ixs: () => Promise<TransactionInstruction[]>;
    shieldAfter?: PublicKey[];
    progress?: Progress;
  }) => Promise<string[]>;
  /// Run raw confidential steps (the Private tab), with incoming sends folded
  /// in first when the steps need it.
  run: (steps: () => Promise<Step[]>, progress?: Progress, applyFirst?: PublicKey) => Promise<string[]>;
};

const C = createContext<Ctx>(null as unknown as Ctx);

export function PrivateProvider({ children }: { children: ReactNode }) {
  const { address, provider } = useSolanaWallet();
  const [keys, setKeys] = useState<Keys>();
  const [unlocking, setUnlocking] = useState(false);
  const [balances, setBalances] = useState<Balance[]>();
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const key = address?.toBase58();

  // A different wallet, different keys: never carry them across.
  useEffect(() => {
    setKeys(undefined);
    setBalances(undefined);
  }, [key]);

  useEffect(() => {
    if (!address) return;
    let alive = true;
    const load = () =>
      lib()
        .then((c) => c.readBalances(connection, address, keys))
        .then((b) => alive && setBalances(b))
        .catch(() => {});
    load();
    const id = setInterval(load, 15_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, keys, tick]);

  const unlock = useCallback(async () => {
    if (!provider) return;
    setUnlocking(true);
    try {
      setKeys(await (await lib()).unlockKeys(provider));
    } finally {
      setUnlocking(false);
    }
  }, [provider]);

  const privateOf = useCallback(
    (mint: PublicKey) => {
      const b = balances?.find((x) => x.token.mint.equals(mint));
      return (b?.private ?? 0n) + (b?.pending ?? 0n);
    },
    [balances],
  );

  const applyIfPending = useCallback(
    async (mint: PublicKey, progress?: Progress) => {
      if (!address || !provider || !keys) return [];
      const c = await lib();
      const steps = await c.applySteps(connection, address, keys, mint);
      return steps.length ? c.runBatch(provider, connection, address, steps, progress) : [];
    },
    [address, provider, keys],
  );

  const run = useCallback<Ctx['run']>(
    async (steps, progress, applyFirst) => {
      if (!address || !provider) throw new Error('Connect a wallet first');
      const sigs = applyFirst ? await applyIfPending(applyFirst, progress) : [];
      progress?.('Building the proofs...');
      sigs.push(...(await (await lib()).runBatch(provider, connection, address, await steps(), progress)));
      refresh();
      return sigs;
    },
    [address, provider, applyIfPending, refresh],
  );

  const execute = useCallback<Ctx['execute']>(
    async ({ unshield, ixs, shieldAfter, progress }) => {
      if (!address || !provider) throw new Error('Connect a wallet first');
      const c = await lib();
      const sigs: string[] = [];
      const steps: Step[] = [];
      if (unshield && unshield.amount > 0n) {
        if (!keys) throw new Error('Unlock your private balances first');
        // The withdraw proof is made against the readable balance, so incoming
        // sends are folded in before it is built.
        sigs.push(...(await applyIfPending(unshield.mint, progress)));
        progress?.('Building the proofs...');
        steps.push(...(await c.unshieldSteps(connection, address, keys, unshield.mint, unshield.amount)));
      }
      steps.push({ ixs: await ixs() });
      sigs.push(...(await c.runBatch(provider, connection, address, steps, progress)));
      if (shieldAfter?.length && keys) {
        const after = await c.readBalances(connection, address, keys);
        const items = shieldAfter
          .map((mint) => ({ mint, amount: after.find((b) => b.token.mint.equals(mint))?.public ?? 0n }))
          .filter((i) => i.amount > 0n);
        if (items.length) {
          progress?.('Returning it to your private balance...');
          sigs.push(...(await c.runBatch(provider, connection, address, await c.shieldSteps(connection, address, keys, items), progress)));
        }
      }
      refresh();
      return sigs;
    },
    [address, provider, keys, applyIfPending, refresh],
  );

  return (
    <C.Provider value={{ keys, unlocked: !!keys, unlocking, unlock, balances, refresh, privateOf, execute, run }}>
      {children}
    </C.Provider>
  );
}

export const usePrivate = () => useContext(C);
