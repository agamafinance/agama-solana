'use client';

import { useState } from 'react';

import { USDC_DECIMALS } from '@/lib/solana/config';
import { useSolanaWallet } from '@/lib/solana/WalletProvider';
import {
  borrowRateBps, errorText, ix, pct, send, supplyRateBps, totalAssets, totalDebt, usd, useSnapshot, utilizationBps,
} from '@/lib/solana/useSolana';
import { AmountBox, card, Hero, Panel, parseAmount, primaryBtn, Row, Stat, Status, toDecimal } from '@/components/solana/ui';

export default function SolanaLendPage() {
  const { address, provider, connect } = useSolanaWallet();
  const { snap, refresh } = useSnapshot(address);
  const p = snap?.protocol;
  const [mode, setMode] = useState<'supply' | 'withdraw'>('supply');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ text: string; sig?: string }>();

  const amt = parseAmount(amount, USDC_DECIMALS);
  const assets = p ? totalAssets(p) : 0n;
  // One LP token is a claim on the pool's cash plus what borrowers owe it.
  const lpValue = (lp: bigint) => (p && p.lpSupply > 0n ? (lp * assets) / p.lpSupply : 0n);
  const lpFor = (usdc: bigint) => (p && assets > 0n ? (usdc * p.lpSupply) / assets : usdc);
  const mine = snap ? lpValue(snap.lp) : 0n;
  const balance = mode === 'supply' ? snap?.usdc ?? 0n : mine;
  const tooMuch = amt > balance || (mode === 'withdraw' && p !== undefined && amt > p.cash);

  async function submit() {
    if (!address || !provider || !snap) return;
    setBusy(true);
    setStatus({ text: mode === 'supply' ? 'Supplying...' : 'Withdrawing...' });
    try {
      // Withdraw takes LP tokens: the max is exact, anything else is converted.
      const arg = mode === 'supply' ? amt : amt >= mine ? snap.lp : lpFor(amt);
      const sig = await send(provider, address, [await ix.lend(address, mode, arg)]);
      setStatus({ text: 'Done.', sig });
      setAmount('');
      refresh();
    } catch (e) {
      setStatus({ text: errorText(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Hero title={<>Lend USDC</>}>
        <p className="mt-4 max-w-[640px] text-[15px] text-fg-muted">
          The pool every Earn and Amplify position borrows from. Supply USDC, earn the borrow rate on the share that is
          lent, withdraw whatever is not lent out at the moment.
        </p>
        <div className="mt-7 flex flex-wrap gap-8">
          <Stat label="Supply APR" value={pct(p ? supplyRateBps(p) : undefined)} sub="Borrow rate x utilization" />
          <Stat label="Borrow APR" value={pct(p ? borrowRateBps(p) : undefined)} sub="Kinked at 80% used" />
          <Stat label="Utilization" value={pct(p ? utilizationBps(p) : undefined)} sub={`${usd(p ? totalDebt(p) : undefined, 0)} lent`} />
        </div>
      </Hero>
      <Panel>
        <div className="grid gap-5 lg:grid-cols-[1fr_1fr] items-start">
          <div className={card}>
            <div className="flex items-center gap-1 rounded-full bg-[#254839]/[0.06] p-1 w-fit">
              {(['supply', 'withdraw'] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => { setMode(k); setAmount(''); setStatus(undefined); }}
                  className={
                    k === mode
                      ? 'rounded-full bg-[#254839] px-4 py-1.5 text-[13px] font-medium capitalize text-[#fdf8ed]'
                      : 'rounded-full px-4 py-1.5 text-[13px] capitalize text-fg-muted hover:text-fg'
                  }
                >
                  {k}
                </button>
              ))}
            </div>
            <AmountBox
              label={mode === 'supply' ? 'Supply' : 'Withdraw'}
              balanceLabel={usd(balance).replace('$', '')}
              onMax={() => setAmount(toDecimal(balance, USDC_DECIMALS))}
              value={amount}
              onChange={setAmount}
              unit="USDC"
            />
            <button
              onClick={address ? submit : () => connect()}
              disabled={busy || (!!address && (amt === 0n || tooMuch))}
              className={`mt-4 ${primaryBtn}`}
            >
              {!address ? 'Connect Wallet' : busy ? status?.text : mode === 'supply' ? 'Supply USDC' : 'Withdraw USDC'}
            </button>
            {!busy && status && <Status text={status.text} sig={status.sig} />}
          </div>
          <div className={card}>
            <h2 className="text-[17px] font-semibold text-fg">The pool</h2>
            <dl className="mt-4 space-y-2 text-[13px]">
              <Row label="Your supply" value={usd(mine)} />
              <Row label="Total supplied" value={usd(assets, 0)} />
              <Row label="Free to withdraw" value={usd(p?.cash, 0)} />
              <Row label="Lent to positions" value={usd(p ? totalDebt(p) : undefined, 0)} />
            </dl>
          </div>
        </div>
      </Panel>
    </>
  );
}
