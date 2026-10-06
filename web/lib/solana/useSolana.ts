'use client';

import { useCallback, useEffect, useState } from 'react';
import { BN, BorshAccountsCoder, Program, type Idl } from '@coral-xyz/anchor';
import {
  Connection,
  PublicKey,
  SystemProgram,
  type TransactionInstruction,
} from '@solana/web3.js';
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token';

import idlJson from './idl.json';
import {
  ata, BPS, lpMint, poolUsdc, positionPda, protocolPda, RPC, STOCKS, usdcMint, VALUE_SCALE, vaultUsdc, WAD, YEAR,
  type Kind, type Stock,
} from './config';
import { sendIxs, type SolanaProvider } from './wallet';

const idl = idlJson as Idl;
export const connection = new Connection(RPC, 'confirmed');
/// Builds instructions only, so it needs a connection and never a wallet.
export const program = new Program(idl, { connection });
const coder = new BorshAccountsCoder(idl);

const big = (x: BN | number | bigint) => BigInt(x.toString());

/// The raw coder keeps the IDL's snake_case field names; `program.account`
/// would camelCase them, but costs one RPC call per account.
function decode(name: string, data: Buffer): Record<string, any> {
  const raw = coder.decode(name, data) as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase()), v]),
  );
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface Protocol {
  cash: bigint;
  totalScaledDebt: bigint;
  borrowIndex: bigint;
  lastAccrual: number;
  baseRateBps: bigint;
  slope1Bps: bigint;
  slope2Bps: bigint;
  kinkBps: bigint;
  minBorrow: bigint;
  vaultShares: bigint;
  navWad: bigint;
  vaultAprBps: bigint;
  couponsPaid: bigint;
  dexFeeBps: bigint;
  lpSupply: bigint;
}

export interface Market {
  stock: Stock;
  priceE8: bigint;
  priceTime: number;
  sessionOpen: boolean;
  maxAge: number;
  ltvBps: bigint;
  ltBps: bigint;
  offhoursBufferBps: bigint;
  /// LTV and threshold right now: the off-hours buffer comes off both.
  ltv: bigint;
  threshold: bigint;
  fresh: boolean;
  totalCollateral: bigint;
  balance: bigint;
}

export interface Position {
  address: PublicKey;
  kind: Kind;
  stock: Stock;
  collateral: bigint;
  debt: bigint;
  shares: bigint;
  buffer: bigint;
  value: bigint;
  ltvBps: bigint;
  targetLtvBps: bigint;
  leverageBps: bigint;
  deposited: bigint;
  stockFromYield: bigint;
  openedAt: number;
  lastAgentAt: number;
  lastAgent: string;
  lastAgentOp: number;
  lastAgentAmount: bigint;
}

export interface Snapshot {
  protocol: Protocol;
  markets: Market[];
  earn: (Position | undefined)[];
  amplify: (Position | undefined)[];
  usdc: bigint;
  lp: bigint;
  sol: number;
  at: number;
}

/// The program's own accrual, run forward to now, so a position read between
/// two transactions shows the debt and the yield it has actually built up.
export function accrue(p: Protocol, now: number): Protocol {
  const dt = BigInt(Math.max(0, now - p.lastAccrual));
  if (dt === 0n) return p;
  const rate = borrowRateBps(p);
  return {
    ...p,
    borrowIndex: p.borrowIndex + (p.borrowIndex * rate * dt) / (BPS * YEAR),
    navWad: p.navWad + (p.navWad * p.vaultAprBps * dt) / (BPS * YEAR),
    lastAccrual: now,
  };
}

export const totalDebt = (p: Protocol) => divUp(p.totalScaledDebt * p.borrowIndex, WAD);
const divUp = (a: bigint, b: bigint) => (a + b - 1n) / b;

export function borrowRateBps(p: Protocol): bigint {
  const debt = totalDebt(p);
  const total = debt + p.cash;
  if (total === 0n) return p.baseRateBps;
  const util = (debt * BPS) / total;
  return util <= p.kinkBps
    ? p.baseRateBps + (p.slope1Bps * util) / p.kinkBps
    : p.baseRateBps + p.slope1Bps + (p.slope2Bps * (util - p.kinkBps)) / (BPS - p.kinkBps);
}

export const utilizationBps = (p: Protocol) => {
  const d = totalDebt(p);
  return d + p.cash === 0n ? 0n : (d * BPS) / (d + p.cash);
};

/// Lenders earn the borrow rate on the share of the pool that is lent.
export const supplyRateBps = (p: Protocol) => (borrowRateBps(p) * utilizationBps(p)) / BPS;
export const totalAssets = (p: Protocol) => p.cash + totalDebt(p);

export const stockValue = (stock: bigint, priceE8: bigint) => (stock * priceE8) / VALUE_SCALE;
export const stockFor = (usdc: bigint, priceE8: bigint, feeBps: bigint) =>
  priceE8 === 0n ? 0n : ((usdc * VALUE_SCALE) / priceE8) * (BPS - feeBps) / BPS;

function decodeProtocol(data: Buffer, lpSupply: bigint): Protocol {
  const a = decode('Protocol', data);
  return {
    cash: big(a.cash),
    totalScaledDebt: big(a.totalScaledDebt),
    borrowIndex: big(a.borrowIndex),
    lastAccrual: Number(a.lastAccrual),
    baseRateBps: big(a.baseRateBps),
    slope1Bps: big(a.slope1Bps),
    slope2Bps: big(a.slope2Bps),
    kinkBps: big(a.kinkBps),
    minBorrow: big(a.minBorrow),
    vaultShares: big(a.vaultShares),
    navWad: big(a.navWad),
    vaultAprBps: big(a.vaultAprBps),
    couponsPaid: big(a.couponsPaid),
    dexFeeBps: big(a.dexFeeBps),
    lpSupply,
  };
}

function decodeMarket(stock: Stock, data: Buffer, balance: bigint, now: number): Market {
  const a = decode('Market', data);
  const ltvBps = big(a.ltvBps);
  const ltBps = big(a.ltBps);
  const buf = big(a.offhoursBufferBps);
  const sessionOpen = !!a.sessionOpen;
  const priceE8 = big(a.priceE8);
  const priceTime = Number(a.priceTime);
  const maxAge = Number(a.maxAge);
  return {
    stock,
    priceE8,
    priceTime,
    sessionOpen,
    maxAge,
    ltvBps,
    ltBps,
    offhoursBufferBps: buf,
    ltv: sessionOpen ? ltvBps : ltvBps - buf,
    threshold: sessionOpen ? ltBps : ltBps - buf,
    fresh: priceE8 > 0n && now - priceTime <= maxAge,
    totalCollateral: big(a.totalCollateral),
    balance,
  };
}

function decodePosition(address: PublicKey, stock: Stock, data: Buffer, p: Protocol, m: Market): Position {
  const a = decode('Position', data);
  const collateral = big(a.collateral);
  const debt = divUp(big(a.scaledDebt) * p.borrowIndex, WAD);
  const shares = big(a.shares);
  const value = stockValue(collateral, m.priceE8);
  return {
    address,
    kind: a.kind === 0 ? 'earn' : 'amplify',
    stock,
    collateral,
    debt,
    shares,
    buffer: (shares * p.navWad) / WAD,
    value,
    ltvBps: value === 0n ? 0n : (debt * BPS) / value,
    targetLtvBps: big(a.targetLtvBps),
    leverageBps: big(a.leverageBps),
    deposited: big(a.deposited),
    stockFromYield: big(a.stockFromYield),
    openedAt: Number(a.openedAt),
    lastAgentAt: Number(a.lastAgentAt),
    lastAgent: new PublicKey(a.lastAgent).toBase58(),
    lastAgentOp: Number(a.lastAgentOp),
    lastAgentAmount: big(a.lastAgentAmount),
  };
}

const tokenAmount = (data: Buffer | undefined) => (data && data.length >= 72 ? data.readBigUInt64LE(64) : 0n);
const mintSupply = (data: Buffer | undefined) => (data && data.length >= 44 ? data.readBigUInt64LE(36) : 0n);

/// Everything every page needs, in one `getMultipleAccounts`: the protocol,
/// the four markets, the LP mint, and when a wallet is connected its eight
/// possible positions and six token balances. One round trip per refresh.
export async function readSnapshot(owner?: PublicKey): Promise<Snapshot> {
  const keys: PublicKey[] = [protocolPda, lpMint, ...STOCKS.map((s) => s.market)];
  if (owner) {
    keys.push(ata(owner, usdcMint), ata(owner, lpMint), ...STOCKS.map((s) => ata(owner, s.stockMint)));
    for (const s of STOCKS) keys.push(positionPda(owner, s.market, 'earn'), positionPda(owner, s.market, 'amplify'));
  }
  const [infos, sol] = await Promise.all([
    connection.getMultipleAccountsInfo(keys),
    owner ? connection.getBalance(owner) : Promise.resolve(0),
  ]);
  const now = Math.floor(Date.now() / 1000);
  if (!infos[0]) throw new Error('Protocol not initialised on this cluster');
  const protocol = accrue(decodeProtocol(infos[0].data, mintSupply(infos[1]?.data)), now);
  const o = 2 + STOCKS.length;
  const markets = STOCKS.map((s, i) =>
    decodeMarket(s, infos[2 + i]!.data, owner ? tokenAmount(infos[o + 2 + i]?.data) : 0n, now),
  );
  const earn: (Position | undefined)[] = [];
  const amplify: (Position | undefined)[] = [];
  if (owner) {
    const base = o + 2 + STOCKS.length;
    STOCKS.forEach((s, i) => {
      const e = infos[base + 2 * i];
      const a = infos[base + 2 * i + 1];
      earn.push(e ? decodePosition(keys[base + 2 * i], s, e.data, protocol, markets[i]) : undefined);
      amplify.push(a ? decodePosition(keys[base + 2 * i + 1], s, a.data, protocol, markets[i]) : undefined);
    });
  }
  return {
    protocol,
    markets,
    earn,
    amplify,
    usdc: owner ? tokenAmount(infos[o]?.data) : 0n,
    lp: owner ? tokenAmount(infos[o + 1]?.data) : 0n,
    sol: sol / 1e9,
    at: now,
  };
}

/// The snapshot, refreshed every 15 s and on demand after a transaction.
export function useSnapshot(owner: PublicKey | undefined) {
  const [snap, setSnap] = useState<Snapshot>();
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const key = owner?.toBase58();

  useEffect(() => {
    let alive = true;
    const load = () =>
      readSnapshot(owner)
        .then((s) => alive && (setSnap(s), setError('')))
        .catch((e) => alive && setError(errorText(e)));
    load();
    const id = setInterval(load, 15_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick]);

  return { snap, error, refresh };
}

// ---------------------------------------------------------------------------
// Instructions
// ---------------------------------------------------------------------------

const sys = {
  tokenProgram: TOKEN_PROGRAM_ID,
  associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
  systemProgram: SystemProgram.programId,
};

export const rails = (s: Stock) => ({
  protocol: protocolPda,
  market: s.market,
  usdcMint,
  stockMint: s.stockMint,
  poolUsdc,
  vaultUsdc,
  custody: s.custody,
});

const m = program.methods as any;

export const ix = {
  faucet: async (user: PublicKey): Promise<TransactionInstruction[]> => [
    await m
      .faucetUsdc()
      .accountsPartial({ user, protocol: protocolPda, usdcMint, userUsdc: ata(user, usdcMint), ...sys })
      .instruction(),
    ...(await Promise.all(
      STOCKS.map((s) =>
        m
          .faucetStock()
          .accountsPartial({
            user,
            protocol: protocolPda,
            market: s.market,
            stockMint: s.stockMint,
            userStock: ata(user, s.stockMint),
            ...sys,
          })
          .instruction(),
      ),
    )),
  ],
  earnDeposit: (user: PublicKey, s: Stock, amount: bigint, targetBps: number) =>
    m
      .earnDeposit(new BN(amount.toString()), targetBps)
      .accountsPartial({
        user,
        position: positionPda(user, s.market, 'earn'),
        ...rails(s),
        userStock: ata(user, s.stockMint),
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction() as Promise<TransactionInstruction>,
  earnSetTarget: (user: PublicKey, s: Stock, targetBps: number) =>
    m
      .earnSetTarget(targetBps)
      .accountsPartial({ user, position: positionPda(user, s.market, 'earn'), ...rails(s), tokenProgram: TOKEN_PROGRAM_ID })
      .instruction() as Promise<TransactionInstruction>,
  earnClose: (user: PublicKey, s: Stock) =>
    m
      .earnClose()
      .accountsPartial({
        user,
        position: positionPda(user, s.market, 'earn'),
        ...rails(s),
        userUsdc: ata(user, usdcMint),
        userStock: ata(user, s.stockMint),
        ...sys,
      })
      .instruction() as Promise<TransactionInstruction>,
  amplifyOpen: (user: PublicKey, s: Stock, amount: bigint, leverageBps: number) =>
    m
      .amplifyOpen(new BN(amount.toString()), leverageBps)
      .accountsPartial({
        user,
        position: positionPda(user, s.market, 'amplify'),
        ...rails(s),
        userStock: ata(user, s.stockMint),
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction() as Promise<TransactionInstruction>,
  amplifyClose: (user: PublicKey, s: Stock) =>
    m
      .amplifyClose()
      .accountsPartial({
        user,
        position: positionPda(user, s.market, 'amplify'),
        ...rails(s),
        userStock: ata(user, s.stockMint),
        ...sys,
      })
      .instruction() as Promise<TransactionInstruction>,
  lend: (user: PublicKey, kind: 'supply' | 'withdraw', amount: bigint) =>
    m[kind](new BN(amount.toString()))
      .accountsPartial({
        user,
        protocol: protocolPda,
        usdcMint,
        lpMint,
        poolUsdc,
        userUsdc: ata(user, usdcMint),
        userLp: ata(user, lpMint),
        ...sys,
      })
      .instruction() as Promise<TransactionInstruction>,
};

/// Sign with the wallet, send to devnet, wait for confirmation by polling.
/// Polling rather than a websocket subscription, which some RPC fronts drop.
export async function send(
  provider: SolanaProvider,
  payer: PublicKey,
  ixs: TransactionInstruction[],
): Promise<string> {
  const sig = await sendIxs(provider, connection, payer, ixs);
  for (let i = 0; i < 60; i++) {
    const { value } = await connection.getSignatureStatuses([sig]);
    const st = value[0];
    if (st?.err) throw new Error(`Transaction failed: ${JSON.stringify(st.err)}`);
    if (st?.confirmationStatus === 'confirmed' || st?.confirmationStatus === 'finalized') return sig;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Not confirmed after 60 s: ${sig}`);
}

/// The program's own error name when there is one, the wallet's message
/// otherwise. Never a stack.
export function errorText(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  const logs: string[] = (e as { logs?: string[] })?.logs ?? [];
  const anchor = [msg, ...logs].join('\n').match(/Error Message: ([^.\n]+)/);
  if (anchor) return anchor[1];
  if (/User rejected|rejected the request/i.test(msg)) return 'Cancelled in the wallet';
  if (/insufficient (funds|lamports)|0x1\b/i.test(msg)) return 'Not enough SOL for the fee. Devnet SOL: faucet.solana.com';
  return msg.split('\n')[0].slice(0, 200);
}

export function ago(at: number): string {
  if (!at) return 'never';
  const s = Math.max(0, Math.floor(Date.now() / 1000) - at);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// Formatting
const fmt = (v: bigint, decimals: number, dp: number) =>
  (Number(v) / 10 ** decimals).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
export const usd = (v: bigint | undefined, dp = 2) => (v === undefined ? '-' : `$${fmt(v, 6, dp)}`);
export const qty = (v: bigint | undefined, dp = 4) => (v === undefined ? '-' : fmt(v, 8, dp));
export const pct = (bps: bigint | number | undefined, dp = 2) =>
  bps === undefined ? '-' : `${(Number(bps) / 100).toFixed(dp).replace(/\.?0+$/, '')}%`;
export const px = (priceE8: bigint | undefined) => (!priceE8 ? '-' : `$${fmt(priceE8, 8, 2)}`);
