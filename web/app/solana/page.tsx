'use client';

import { useEffect, useState } from 'react';

import { asset, AGENT_OPS, BPS, STOCK_DECIMALS, usdcMint } from '@/lib/solana/config';
import { usePrivate } from '@/lib/solana/PrivateContext';
import { FromPrivateNote, ReturnPrivately } from '@/components/solana/private';
import { useSolanaWallet } from '@/lib/solana/WalletProvider';
import {
  ago, borrowRateBps, errorText, ix, pct, px, qty, send, stockValue, usd, useSnapshot,
} from '@/lib/solana/useSolana';
import {
  AgentsCard, AmountBox, card, Hero, CreBadge, MarketCards, Panel, parseAmount, primaryBtn, Row, secondaryBtn, SessionBadge,
  Stat, Status, toDecimal,
} from '@/components/solana/ui';

export default function SolanaEarnPage() {
  const { address, provider, connect } = useSolanaWallet();
  const { snap, error, refresh } = useSnapshot(address);
  const priv = usePrivate();
  const [backPrivate, setBackPrivate] = useState(true);
  const [sel, setSel] = useState(0);
  const m = snap?.markets[sel];
  const position = snap?.earn[sel];
  const p = snap?.protocol;

  const [amount, setAmount] = useState('');
  // The slider is in bps of LTV. Undefined until the market says what it
  // allows, then a level that leaves the position well clear of liquidation.
  const [picked, setPicked] = useState<number>();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ text: string; sig?: string; where: 'deposit' | 'close' | 'slider' }>();

  const maxLtv = m ? Number(m.ltv) : 0;
  const defaultLtv = Math.floor((maxLtv * 0.8) / 50) * 50;
  const ltv = Math.min(picked ?? (position ? Number(position.targetLtvBps) : defaultLtv), maxLtv);
  useEffect(() => setPicked(undefined), [sel]);

  const amt = parseAmount(amount, STOCK_DECIMALS);
  // Public first; whatever the public balance lacks comes out of the private one.
  const privBal = m ? priv.privateOf(m.stock.stockMint) : 0n;
  const pub = m?.balance ?? 0n;
  const fromPrivate = amt > pub ? amt - pub : 0n;
  const enough = amt <= pub + privBal;
  const borrowed = m ? (stockValue(amt, m.priceE8) * BigInt(ltv)) / BPS : 0n;
  const borrowRate = p ? borrowRateBps(p) : undefined;
  const spread = p && borrowRate !== undefined ? p.vaultAprBps - borrowRate : undefined;
  const extra = spread !== undefined ? (spread * BigInt(ltv)) / BPS : undefined;
  const healthAtOpen = m && ltv > 0 ? (Number(m.threshold) / ltv).toFixed(2) : '-';

  async function run(
    where: 'deposit' | 'close' | 'slider',
    build: () => Promise<Parameters<typeof send>[2]>,
    msg: string,
    privacy?: { unshield?: bigint; shieldAfter?: boolean },
  ) {
    if (!address || !provider) return;
    setBusy(true);
    setStatus({ text: msg, where });
    try {
      let sig: string;
      if (privacy && (privacy.unshield || privacy.shieldAfter)) {
        const sigs = await priv.execute({
          unshield: privacy.unshield ? { mint: m!.stock.stockMint, amount: privacy.unshield } : undefined,
          ixs: build,
          shieldAfter: privacy.shieldAfter ? [m!.stock.stockMint, usdcMint] : undefined,
          progress: (text) => setStatus({ text, where }),
        });
        sig = sigs[sigs.length - 1];
        setStatus({ text: `Done. ${sigs.length} transactions.`, sig, where });
      } else {
        sig = await send(provider, address, await build());
        setStatus({ text: 'Done.', sig, where });
      }
      if (where === 'deposit') setAmount('');
      refresh();
    } catch (e) {
      setStatus({ text: errorText(e), where });
    } finally {
      setBusy(false);
    }
  }

  const deposit = () =>
    run('deposit', async () => [await ix.earnDeposit(address!, m!.stock, amt, ltv)], 'Depositing and borrowing...', {
      unshield: fromPrivate,
    });
  const close = () =>
    run('close', async () => [await ix.earnClose(address!, m!.stock)], 'Closing...', {
      shieldAfter: priv.unlocked && backPrivate,
    });
  const moveSlider = () =>
    run('slider', async () => [await ix.earnSetTarget(address!, m!.stock, ltv)], 'Moving the position...');

  const has = !!position;
  const health =
    position && position.debt > 0n ? (Number(position.value * m!.threshold) / Number(position.debt * BPS)).toFixed(2) : undefined;
  const sliderMoved = has && ltv !== Number(position!.targetLtvBps);

  return (
    <>
      <Hero
        art={asset('/logos/coin-pair-earn.svg')}
        title={
          <>
            Deposit your stock,
            <br />
            get more stock
          </>
        }
      >
        <p className="mt-4 max-w-[640px] text-[15px] text-fg-muted">
          Deposit a tokenized stock. Agama borrows USDC against it at the level you pick, puts it to work in the
          private-credit vault, and permissionless agents hold that level and turn the yield back into more of your
          stock. Live on Solana devnet, with stand-in tokens priced off the real xStocks.
        </p>
        <div className="mt-7 flex flex-wrap gap-8">
          <Stat label="Vault APY" value={pct(p?.vaultAprBps)} sub="Private credit, devnet rate" />
          <Stat label="Borrow APR" value={pct(borrowRate)} sub="USDC, variable" />
          <Stat label="Spread you earn" value={pct(spread)} sub="On every USDC borrowed" />
        </div>
      </Hero>

      <Panel>
        {error && !snap && <p className="text-[13px] text-[#b4571f]">{error}</p>}
        {snap && <MarketCards markets={snap.markets} sel={sel} onSelect={setSel} connected={!!address} />}
        {snap && <CreBadge cre={snap.cre} />}

        <div className="grid gap-5 lg:grid-cols-[1fr_1fr] items-start">
          <div className={card}>
            <div className="flex items-center justify-between">
              <h2 className="text-[17px] font-semibold text-fg">Deposit {m?.stock.ticker ?? ''}</h2>
              <SessionBadge m={m} />
            </div>

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
                <span className="text-fg-muted">Level the agents hold</span>
                <span className="font-medium text-fg tabular-nums" data-testid="ltv">
                  {pct(ltv)} of the stock
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={maxLtv}
                step={50}
                value={ltv}
                onChange={(e) => setPicked(Number(e.target.value))}
                className="mt-2 w-full accent-[#254839]"
                aria-label="Target LTV"
              />
              <div className="flex justify-between text-[11px] text-fg-muted">
                <span>0%</span>
                <span>
                  {pct(maxLtv)} max{m && !m.sessionOpen ? `, ${pct(m.offhoursBufferBps)} off while NYSE is closed` : ''}
                </span>
              </div>
            </div>

            <dl className="mt-4 space-y-2 text-[13px]">
              <Row label="Borrowed into the vault" value={borrowed > 0n ? usd(borrowed) : '-'} />
              <Row label="Extra yield on the stock" value={extra !== undefined && ltv > 0 ? `${pct(extra)} a year` : '-'} />
              <Row label="Health factor at open" value={healthAtOpen} />
            </dl>
            {m && !m.fresh && (
              <p className="mt-3 text-[12px] text-[#b4571f]">
                No fresh price for {m.stock.ticker}: borrowing waits until the keeper relays one.
              </p>
            )}

            <button
              onClick={address ? deposit : () => connect()}
              disabled={busy || (!!address && (amt === 0n || !m || !enough || ltv === 0))}
              className={`mt-4 ${primaryBtn}`}
            >
              {!address
                ? 'Connect Wallet'
                : busy && status?.where === 'deposit'
                  ? status.text
                  : m && !enough
                    ? `Not enough ${m.stock.ticker}, see the Faucet`
                    : fromPrivate > 0n
                      ? 'Unshield and deposit'
                      : has
                      ? 'Add to the position'
                      : 'Deposit and start earning'}
            </button>
            {fromPrivate > 0n && enough && <FromPrivateNote amount={qty(fromPrivate)} label={m?.stock.ticker ?? ''} />}
            {!busy && status?.where === 'deposit' && <Status text={status.text} sig={status.sig} />}
          </div>

          <div className={card}>
            <h2 className="text-[17px] font-semibold text-fg">Your position</h2>
            {!has ? (
              <p className="mt-4 text-[14px] text-fg-muted">
                Nothing here yet. Deposit a stock and the protocol does the rest: it borrows against it, puts the USDC
                to work, and keeps the position where you set it.
              </p>
            ) : (
              <>
                <div className="mt-4 flex flex-wrap gap-8">
                  <Stat
                    label={`Your ${m?.stock.ticker}`}
                    value={qty(position!.collateral)}
                    sub={
                      position!.stockFromYield > 0n
                        ? `+${qty(position!.stockFromYield)} bought with the yield`
                        : usd(position!.value)
                    }
                  />
                  <Stat label="Health factor" value={health ?? 'No debt'} sub="Liquidation below 1.00" />
                </div>
                <dl className="mt-5 space-y-2 text-[13px]">
                  <Row label="Debt" value={usd(position!.debt)} />
                  <Row label="Yield buffer in the vault" value={usd(position!.buffer)} />
                  <Row label="Level now" value={pct(position!.ltvBps)} />
                  <Row label="Target level" value={pct(position!.targetLtvBps)} />
                </dl>
                {sliderMoved && (
                  <button onClick={moveSlider} disabled={busy} className={`mt-4 ${secondaryBtn}`}>
                    {busy && status?.where === 'slider' ? status.text : `Move the target to ${pct(ltv)}`}
                  </button>
                )}
                {!busy && status?.where === 'slider' && <Status text={status.text} sig={status.sig} />}
                <AgentsCard
                  last={
                    position!.lastAgentOp
                      ? `Last action: ${AGENT_OPS[position!.lastAgentOp]}, ${ago(position!.lastAgentAt)}.`
                      : 'No agent action yet. The position is on target.'
                  }
                >
                  The stock moves, the debt follows it back to {pct(position!.targetLtvBps)}. The vault yield above
                  that debt is bought back as more stock. Nothing here is yours to do, and nothing here is ours to
                  control: the calls are open to anyone.
                </AgentsCard>
                <ReturnPrivately checked={backPrivate} onChange={setBackPrivate} what="the stock and any USDC left over" />
                <button onClick={close} disabled={busy} className={`mt-4 ${secondaryBtn}`}>
                  {busy && status?.where === 'close' ? status.text : 'Close, get the stock back'}
                </button>
              </>
            )}
            {/* Outside the branch on purpose: closing empties this card, and a
                confirmation that unmounts with it confirms nothing. */}
            {!busy && status?.where === 'close' && <Status text={status.text} sig={status.sig} />}
          </div>
        </div>

        <p className="text-[12px] text-fg-muted">
          Devnet: the stocks, GLDY and USDC are stand-ins minted by the Faucet tab; no xStock or GLDY faucet exists
          on devnet, and GLDY itself is permissioned. Prices are real: a Chainlink CRE workflow reads the live xStocks
          on Jupiter (the share price while NYSE trades, the token&apos;s own price outside it) and GLDY off Orca&apos;s
          pool, and swaps settle at that price minus 5 bps.
        </p>
      </Panel>
    </>
  );
}
