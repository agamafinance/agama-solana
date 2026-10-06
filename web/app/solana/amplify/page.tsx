'use client';

import { useEffect, useState } from 'react';

import { asset, AGENT_OPS, BPS, STOCK_DECIMALS } from '@/lib/solana/config';
import { usePrivate } from '@/lib/solana/PrivateContext';
import { FromPrivateNote, ReturnPrivately } from '@/components/solana/private';
import { useSolanaWallet } from '@/lib/solana/WalletProvider';
import {
  ago, borrowRateBps, errorText, ix, pct, px, qty, send, stockFor, stockValue, usd, useSnapshot,
} from '@/lib/solana/useSolana';
import {
  AgentsCard, AmountBox, card, Hero, CreBadge, MarketCards, Panel, parseAmount, primaryBtn, Row, secondaryBtn, SessionBadge,
  Stat, Status, toDecimal,
} from '@/components/solana/ui';

export default function SolanaAmplifyPage() {
  const { address, provider, connect } = useSolanaWallet();
  const { snap, error, refresh } = useSnapshot(address);
  const priv = usePrivate();
  const [backPrivate, setBackPrivate] = useState(true);
  const [sel, setSel] = useState(3);
  const m = snap?.markets[sel];
  const position = snap?.amplify[sel];
  const p = snap?.protocol;

  const [amount, setAmount] = useState('');
  const [picked, setPicked] = useState<number>();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ text: string; sig?: string; where: 'open' | 'close' }>();
  useEffect(() => setPicked(undefined), [sel]);

  // A loop at L carries an LTV of (L - 1) / L, so the market's LTV caps L at
  // 1 / (1 - LTV). The swap fee nudges the LTV up a hair, so the slider stops
  // just short of the edge rather than ending in a revert.
  const ltv = m ? Number(m.ltv) / 10_000 : 0;
  const maxLev = m ? Math.floor((1 / (1 - ltv * 0.995)) * 100) / 100 : 1;
  const lev = Math.min(picked ?? Math.max(1.1, Math.floor(maxLev * 90) / 100), maxLev);
  const levBps = Math.round(lev * 10_000);

  const amt = parseAmount(amount, STOCK_DECIMALS);
  const privBal = m ? priv.privateOf(m.stock.stockMint) : 0n;
  const pub = m?.balance ?? 0n;
  const fromPrivate = amt > pub ? amt - pub : 0n;
  const enough = amt <= pub + privBal;
  const borrow = m ? (stockValue(amt, m.priceE8) * BigInt(levBps - 10_000)) / BPS : 0n;
  const bought = m && p ? stockFor(borrow, m.priceE8, p.dexFeeBps) : 0n;
  const ltvAfter = m && amt > 0n ? (borrow * BPS) / stockValue(amt + bought, m.priceE8) : 0n;

  async function run(
    where: 'open' | 'close',
    build: () => Promise<Parameters<typeof send>[2]>,
    msg: string,
    privacy?: { unshield?: bigint; shieldAfter?: boolean },
  ) {
    if (!address || !provider) return;
    setBusy(true);
    setStatus({ text: msg, where });
    try {
      if (privacy && (privacy.unshield || privacy.shieldAfter)) {
        const sigs = await priv.execute({
          unshield: privacy.unshield ? { mint: m!.stock.stockMint, amount: privacy.unshield } : undefined,
          ixs: build,
          shieldAfter: privacy.shieldAfter ? [m!.stock.stockMint] : undefined,
          progress: (text) => setStatus({ text, where }),
        });
        setStatus({ text: `Done. ${sigs.length} transactions.`, sig: sigs[sigs.length - 1], where });
      } else {
        const sig = await send(provider, address, await build());
        setStatus({ text: 'Done.', sig, where });
      }
      if (where === 'open') setAmount('');
      refresh();
    } catch (e) {
      setStatus({ text: errorText(e), where });
    } finally {
      setBusy(false);
    }
  }

  const health =
    position && position.debt > 0n ? (Number(position.value * m!.threshold) / Number(position.debt * BPS)).toFixed(2) : undefined;
  const exposure = position && position.value > position.debt
    ? (Number(position.value) / Number(position.value - position.debt)).toFixed(2)
    : undefined;

  return (
    <>
      <Hero art={asset('/logos/coin-pair-amplify.svg')} title={<>Amplify your stock</>}>
        <p className="mt-4 max-w-[640px] text-[15px] text-fg-muted">
          One slider. Agama borrows USDC against your stock, buys more of the same stock with it and pledges it, all
          in one transaction. The agents hold the multiple as the price moves: they buy a little more when it rises
          and sell just enough to repay when it falls.
        </p>
        <div className="mt-7 flex flex-wrap gap-8">
          <Stat label="Borrow APR" value={pct(p ? borrowRateBps(p) : undefined)} sub="USDC, variable" />
          <Stat label="Max multiple" value={m ? `${maxLev.toFixed(2)}x` : '-'} sub={`${m?.stock.ticker ?? ''} at ${pct(m?.ltv)} LTV`} />
        </div>
      </Hero>

      <Panel>
        {error && !snap && <p className="text-[13px] text-[#b4571f]">{error}</p>}
        {snap && <MarketCards markets={snap.markets} sel={sel} onSelect={setSel} connected={!!address} />}
        {snap && <CreBadge cre={snap.cre} />}

        <div className="grid gap-5 lg:grid-cols-[1fr_1fr] items-start">
          <div className={card}>
            <div className="flex items-center justify-between">
              <h2 className="text-[17px] font-semibold text-fg">Loop {m?.stock.ticker ?? ''}</h2>
              <SessionBadge m={m} />
            </div>
            {position ? (
              <p className="mt-4 text-[14px] text-fg-muted">
                You already have a loop on {m?.stock.ticker}. Close it to open a new one at a different multiple.
              </p>
            ) : (
              <>
                <AmountBox
                  label="Deposit"
                  balanceLabel={privBal > 0n ? `${qty(m?.balance)} + ${qty(privBal)} private` : qty(m?.balance)}
                  onMax={() => m && setAmount(toDecimal(m.balance + privBal, STOCK_DECIMALS))}
                  value={amount}
                  onChange={setAmount}
                  unit={m?.stock.ticker ?? ''}
                  hint={`${px(m?.priceE8)} per share`}
                />
                <div className="mt-5">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-fg-muted">Multiple</span>
                    <span className="font-medium text-fg tabular-nums">{lev.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min={1.05}
                    max={maxLev}
                    step={0.01}
                    value={lev}
                    onChange={(e) => setPicked(Number(e.target.value))}
                    className="mt-2 w-full accent-[#254839]"
                    aria-label="Leverage"
                  />
                  <div className="flex justify-between text-[11px] text-fg-muted">
                    <span>1.05x</span>
                    <span>{maxLev.toFixed(2)}x max</span>
                  </div>
                </div>
                <dl className="mt-4 space-y-2 text-[13px]">
                  <Row label="Borrowed" value={borrow > 0n ? usd(borrow) : '-'} />
                  <Row label="Stock bought with it" value={bought > 0n ? `${qty(bought)} ${m?.stock.ticker}` : '-'} />
                  <Row label="Exposure" value={amt > 0n ? `${qty(amt + bought)} ${m?.stock.ticker}` : '-'} />
                  <Row label="LTV after" value={ltvAfter > 0n ? `${pct(ltvAfter)} of ${pct(m?.ltv)} max` : '-'} />
                </dl>
                <button
                  onClick={
                    address
                      ? () =>
                          run('open', async () => [await ix.amplifyOpen(address, m!.stock, amt, levBps)], 'Looping...', {
                            unshield: fromPrivate,
                          })
                      : () => connect()
                  }
                  disabled={busy || (!!address && (amt === 0n || !m || !enough))}
                  className={`mt-4 ${primaryBtn}`}
                >
                  {!address
                    ? 'Connect Wallet'
                    : busy && status?.where === 'open'
                      ? status.text
                      : m && !enough
                        ? `Not enough ${m.stock.ticker}, see the Faucet`
                        : fromPrivate > 0n
                          ? `Unshield and amplify ${lev.toFixed(2)}x`
                          : `Amplify ${lev.toFixed(2)}x`}
                </button>
                {fromPrivate > 0n && enough && <FromPrivateNote amount={qty(fromPrivate)} label={m?.stock.ticker ?? ''} />}
              </>
            )}
            {!busy && status?.where === 'open' && <Status text={status.text} sig={status.sig} />}
          </div>

          <div className={card}>
            <h2 className="text-[17px] font-semibold text-fg">Your loop</h2>
            {!position ? (
              <p className="mt-4 text-[14px] text-fg-muted">No loop on {m?.stock.ticker ?? 'this stock'}.</p>
            ) : (
              <>
                <div className="mt-4 flex flex-wrap gap-8">
                  <Stat label={`Your ${m?.stock.ticker}`} value={qty(position.collateral)} sub={`${qty(position.deposited)} deposited`} />
                  <Stat label="Multiple" value={exposure ? `${exposure}x` : '-'} sub={`Target ${(Number(position.leverageBps) / 10_000).toFixed(2)}x`} />
                  <Stat label="Health factor" value={health ?? 'No debt'} sub="Liquidation below 1.00" />
                </div>
                <dl className="mt-5 space-y-2 text-[13px]">
                  <Row label="Value" value={usd(position.value)} />
                  <Row label="Debt" value={usd(position.debt)} />
                  <Row label="Level now / target" value={`${pct(position.ltvBps)} / ${pct(position.targetLtvBps)}`} />
                </dl>
                <AgentsCard
                  last={
                    position.lastAgentOp
                      ? `Last action: ${AGENT_OPS[position.lastAgentOp]}, ${ago(position.lastAgentAt)}.`
                      : 'No agent action yet. The loop is on target.'
                  }
                >
                  The price rises, the agents borrow and buy more stock; it falls, they sell just enough to repay. The
                  multiple stays where you set it. A Chainlink CRE workflow makes the calls every minute, and anyone else can too.
                </AgentsCard>
                <ReturnPrivately checked={backPrivate} onChange={setBackPrivate} what="the stock" />
                <button
                  onClick={() =>
                    run('close', async () => [await ix.amplifyClose(address!, m!.stock)], 'Unwinding...', {
                      shieldAfter: priv.unlocked && backPrivate,
                    })
                  }
                  disabled={busy}
                  className={`mt-4 ${secondaryBtn}`}
                >
                  {busy && status?.where === 'close' ? status.text : 'Close, sell what repays, keep the rest'}
                </button>
              </>
            )}
            {!busy && status?.where === 'close' && <Status text={status.text} sig={status.sig} />}
          </div>
        </div>
      </Panel>
    </>
  );
}
