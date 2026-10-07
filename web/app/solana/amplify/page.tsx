'use client';

import { useEffect, useState } from 'react';

import { asset, AGENT_OPS, BPS, STOCK_DECIMALS } from '@/lib/solana/config';
import { usePrivate, type PublicLeft } from '@/lib/solana/PrivateContext';
import { ActionStatus, PrivacyBar, statusFromError } from '@/components/solana/privacy';
import { useSolanaWallet } from '@/lib/solana/WalletProvider';
import {
  ago, borrowRateBps, ix, pct, px, qty, stockFor, stockValue, usd, useSnapshot,
} from '@/lib/solana/useSolana';
import {
  AgentsCard, AmountBox, card, Hero, CreBadge, MarketCards, Panel, parseAmount, primaryBtn, Row, secondaryBtn, SessionBadge,
  Stat, Step, toDecimal,
} from '@/components/solana/ui';

export default function SolanaAmplifyPage() {
  const { address, provider, connect } = useSolanaWallet();
  const { snap, error, refresh } = useSnapshot(address);
  const priv = usePrivate();
  const [sel, setSel] = useState(3);
  // Open on the stock asked for (?s=NVDA, from Portfolio), else on the first
  // market this wallet already has a position in.
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    if (opened || !snap) return;
    const want = new URLSearchParams(window.location.search).get('s');
    const byParam = want ? snap.markets.findIndex((mk) => mk.stock.symbol === want) : -1;
    const held = snap.amplify.findIndex((x) => !!x);
    if (byParam >= 0) setSel(byParam);
    else if (held >= 0) setSel(held);
    setOpened(true);
  }, [snap, opened]);
  const m = snap?.markets[sel];
  const position = snap?.amplify[sel];
  const p = snap?.protocol;

  const [amount, setAmount] = useState('');
  const [picked, setPicked] = useState<number>();
  const busy = priv.busy;
  const [status, setStatus] = useState<{ text: string; sig?: string; left?: PublicLeft[]; where: 'open' | 'close' }>();
  useEffect(() => setPicked(undefined), [sel]);

  // A loop at L carries an LTV of (L - 1) / L, so the market's LTV caps L at
  // 1 / (1 - LTV). The swap fee nudges the LTV up a hair, so the slider stops
  // just short of the edge rather than ending in a revert.
  const ltv = m ? Number(m.ltv) / 10_000 : 0;
  // An LTV at or below zero (a market whose off-hours buffer ate it) allows no loop.
  const maxLev = m && ltv > 0 ? Math.floor((1 / (1 - ltv * 0.995)) * 100) / 100 : 1;
  const canLoop = maxLev > 1.05;
  const lev = Math.min(picked ?? Math.max(1.1, Math.floor(maxLev * 90) / 100), maxLev);
  const levBps = Math.round(lev * 10_000);

  const amt = parseAmount(amount, STOCK_DECIMALS);
  const privBal = m ? priv.privateOf(m.stock.stockMint) : 0n;
  const pub = m?.balance ?? 0n;
  const held = pub + privBal;
  const fromPrivate = amt > pub ? amt - pub : 0n;
  const enough = !priv.unlocked || amt <= held;
  const borrow = m ? (stockValue(amt, m.priceE8) * BigInt(levBps - 10_000)) / BPS : 0n;
  const bought = m && p ? stockFor(borrow, m.priceE8, p.dexFeeBps) : 0n;
  const ltvAfter = m && amt > 0n ? (borrow * BPS) / stockValue(amt + bought, m.priceE8) : 0n;

  async function run(
    where: 'open' | 'close',
    label: string,
    build: () => Promise<Awaited<ReturnType<typeof ix.amplifyClose>>[]>,
    msg: string,
    o: { spend?: bigint; returns?: boolean } = {},
  ) {
    if (!address || !provider) return setStatus({ text: 'Connect a wallet first.', where });
    if (!m) return setStatus({ text: 'Markets are still loading.', where });
    setStatus({ text: msg, where });
    try {
      const sigs = await priv.act({
        label,
        spend: o.spend ? { mint: m.stock.stockMint, amount: o.spend } : undefined,
        ixs: build,
        returns: o.returns ? [m.stock.stockMint] : undefined,
        progress: (text) => setStatus({ text, where }),
      });
      setStatus({ text: sigs.length > 1 ? `Done. ${sigs.length} transactions.` : 'Done.', sig: sigs[sigs.length - 1], where });
      if (where === 'open') setAmount('');
    } catch (e) {
      setStatus({ ...statusFromError(e), where });
    } finally {
      refresh();
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
          One slider. Agama borrows USDC against your stock, buys more of the same stock with it and pledges it, in
          one transaction; your stock leaves and returns to your private balance around it. The agents hold the multiple as the price moves: they buy a little more when it rises
          and sell just enough to repay when it falls.
        </p>
        <div className="mt-7 flex flex-wrap gap-8">
          <Stat label="Borrow APR" value={pct(p ? borrowRateBps(p) : undefined)} sub="USDC, variable" />
          <Stat label="Max multiple" value={m ? `${maxLev.toFixed(2)}x` : '-'} sub={`${m?.stock.ticker ?? ''} at ${pct(m?.ltv)} LTV`} />
        </div>
      </Hero>

      <Panel>
        <PrivacyBar sol={snap?.sol} />
        {error && !snap && <p className="text-[13px] text-[#b4571f]">{error}</p>}
        {error && snap && (
          <p className="text-[12px] text-[#b4571f]">Showing data from {ago(snap.at)}: the RPC is not answering, retrying.</p>
        )}
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
                  balanceLabel={priv.unlocked ? `${qty(held)} private` : pub > 0n ? `${qty(pub)} public, private locked` : 'private, locked'}
                  onMax={() => m && setAmount(toDecimal(held, STOCK_DECIMALS))}
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
                          run('open', 'loop', async () => [await ix.amplifyOpen(address, m!.stock, amt, levBps)], 'Looping...', {
                            spend: amt,
                          })
                      : () => connect()
                  }
                  disabled={busy || (!!address && (!m || amt === 0n || !enough || !canLoop))}
                  className={`mt-4 ${primaryBtn}`}
                >
                  {!address
                    ? 'Connect Wallet'
                    : busy && status?.where === 'open'
                      ? <Step text={status.text} />
                      : !m
                        ? 'Loading markets...'
                        : !canLoop
                          ? 'No loop possible on this market right now'
                          : !enough
                            ? `Not enough ${m.stock.ticker}, see the Faucet`
                            : amt === 0n
                              ? 'Enter an amount'
                              : `Amplify ${lev.toFixed(2)}x`}
                </button>
                {amt > 0n && fromPrivate > 0n && (
                  <p className="mt-2 text-[12px] text-fg-muted">
                    {qty(fromPrivate)} {m?.stock.ticker} leaves your private balance first: one approval, about 5
                    transactions. The program sees the amount, as it must to price the loan.
                  </p>
                )}
              </>
            )}
            {!busy && status?.where === 'open' && <ActionStatus status={status} />}
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
                <p className="mt-3 text-[12px] text-fg-muted">
                  Closing hands what is left of the stock back to your private balance: one approval for the close,
                  one for the shield.
                </p>
                <button
                  onClick={() =>
                    run('close', 'close', async () => [await ix.amplifyClose(address!, m!.stock)], 'Unwinding...', {
                      returns: true,
                    })
                  }
                  disabled={busy}
                  className={`mt-4 ${secondaryBtn}`}
                >
                  {busy && status?.where === 'close' ? <Step text={status.text} /> : 'Close, sell what repays, keep the rest'}
                </button>
              </>
            )}
            {!busy && status?.where === 'close' && <ActionStatus status={status} />}
          </div>
        </div>
      </Panel>
    </>
  );
}
