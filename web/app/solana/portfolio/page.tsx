'use client';

import Link from 'next/link';

import { TokenIcon } from '@/components/icons/TokenIcon';
import { AGENT_OPS, BPS, explorerAddr, usdcMint } from '@/lib/solana/config';
import { usePrivate } from '@/lib/solana/PrivateContext';
import { useSolanaWallet } from '@/lib/solana/WalletProvider';
import { ago, pct, qty, usd, useSnapshot, type Position } from '@/lib/solana/useSolana';
import { PrivacyBar } from '@/components/solana/privacy';
import { card, Hero, Panel, primaryBtn, Stat } from '@/components/solana/ui';

export default function SolanaPortfolioPage() {
  const { address, connect } = useSolanaWallet();
  const { snap, error } = useSnapshot(address);
  const priv = usePrivate();

  const positions: Position[] = snap ? [...snap.earn, ...snap.amplify].filter((x): x is Position => !!x) : [];
  const equity = positions.reduce((a, x) => a + x.value + x.buffer - x.debt, 0n);
  // Holdings: the private balance plus any public remainder, valued at the
  // oracle. Unknown while locked.
  const held = (mint: Parameters<typeof priv.privateOf>[0], pub: bigint) => priv.privateOf(mint) + pub;
  const holdings = snap
    ? snap.markets.map((m) => {
        const amount = held(m.stock.stockMint, m.balance);
        return { m, amount, value: (amount * m.priceE8) / 10n ** 10n };
      })
    : [];
  const usdcHeld = snap ? held(usdcMint, snap.usdc) : 0n;
  const wallet = holdings.reduce((a, h) => a + h.value, usdcHeld);

  return (
    <>
      <Hero title={<>Portfolio</>}>
        <p className="mt-4 max-w-[640px] text-[15px] text-fg-muted">
          Every position this wallet holds on Agama for Solana, what the agents last did to each, and the private
          balances only this wallet can read.
        </p>
        {address && (
          <div className="mt-7 flex flex-wrap gap-8">
            <Stat label="In positions" value={usd(equity)} sub="Stock plus vault buffer, less debt" />
            <Stat
              label="In the wallet, private"
              value={priv.unlocked ? usd(wallet) : 'Locked'}
              sub={priv.unlocked ? 'USDC, stocks and gold at the oracle' : 'Unlock to read your private balances'}
            />
          </div>
        )}
      </Hero>
      <Panel>
        <PrivacyBar />
        {error && snap && <p className="text-[12px] text-[#b4571f]">Showing data from {ago(snap.at)}: the RPC is not answering, retrying.</p>}
        {address && priv.unlocked && snap && (
          <div className={card} data-testid="balances">
            <h2 className="text-[17px] font-semibold text-fg">Private balances</h2>
            <table className="mt-3 w-full text-[14px]">
              <tbody>
                <tr className="border-t border-[#254839]/10">
                  <td className="py-2"><span className="flex items-center gap-2"><TokenIcon symbol="USDC" size={20} />USDC</span></td>
                  <td className="py-2 text-right tabular-nums" data-testid="held-USDC">{usd(usdcHeld).replace('$', '')}</td>
                  <td className="py-2 text-right tabular-nums text-fg-muted">{usd(usdcHeld)}</td>
                </tr>
                {holdings.map((h) => (
                  <tr key={h.m.stock.symbol} className="border-t border-[#254839]/10">
                    <td className="py-2"><span className="flex items-center gap-2"><TokenIcon symbol={h.m.stock.ticker} size={20} />{h.m.stock.ticker}</span></td>
                    <td className="py-2 text-right tabular-nums" data-testid={`held-${h.m.stock.symbol}`}>{qty(h.amount)}</td>
                    <td className="py-2 text-right tabular-nums text-fg-muted">{usd(h.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!address ? (
          <div className={`${card} max-w-[480px]`}>
            <p className="text-[14px] text-fg-muted">Connect a wallet to see its positions.</p>
            <button onClick={() => connect()} className={`mt-4 ${primaryBtn}`}>Connect Wallet</button>
          </div>
        ) : positions.length === 0 ? (
          <div className={`${card} max-w-[480px]`}>
            <p className="text-[14px] text-fg-muted">
              No position yet. Start on <Link href="/solana" className="underline">Earn</Link> or{' '}
              <Link href="/solana/amplify" className="underline">Amplify</Link>.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {positions.map((x) => {
              const m = snap!.markets.find((mk) => mk.stock.symbol === x.stock.symbol)!;
              const hf = x.debt > 0n ? (Number(x.value * m.threshold) / Number(x.debt * BPS)).toFixed(2) : 'No debt';
              return (
                <div key={x.address.toBase58()} className={card}>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <TokenIcon symbol={x.stock.ticker} size={24} />
                      <span className="text-[16px] font-semibold text-fg">{x.stock.ticker}</span>
                      <span className="rounded-full bg-[#254839]/[0.06] px-2.5 py-0.5 text-[12px] text-fg">
                        {x.kind === 'earn' ? 'Earn' : `Amplify ${(Number(x.leverageBps) / 10_000).toFixed(2)}x`}
                      </span>
                    </span>
                    <a href={explorerAddr(x.address.toBase58())} target="_blank" rel="noreferrer" className="text-[12px] text-fg-muted underline">
                      Account
                    </a>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-y-2 text-[13px]">
                    <dt className="text-fg-muted">Stock</dt>
                    <dd className="text-right tabular-nums text-fg">{qty(x.collateral)} ({usd(x.value)})</dd>
                    <dt className="text-fg-muted">Debt</dt>
                    <dd className="text-right tabular-nums text-fg">{usd(x.debt)}</dd>
                    {x.kind === 'earn' && (
                      <>
                        <dt className="text-fg-muted">Vault buffer</dt>
                        <dd className="text-right tabular-nums text-fg">{usd(x.buffer)}</dd>
                        <dt className="text-fg-muted">Bought with the yield</dt>
                        <dd className="text-right tabular-nums text-fg">{qty(x.stockFromYield)}</dd>
                      </>
                    )}
                    <dt className="text-fg-muted">Level / target</dt>
                    <dd className="text-right tabular-nums text-fg">{pct(x.ltvBps)} / {pct(x.targetLtvBps)}</dd>
                    <dt className="text-fg-muted">Health factor</dt>
                    <dd className="text-right tabular-nums text-fg">{hf}</dd>
                  </dl>
                  <p className="mt-3 text-[12px] text-fg-muted">
                    {x.lastAgentOp ? `Agents: ${AGENT_OPS[x.lastAgentOp]}, ${ago(x.lastAgentAt)}.` : 'Agents: no action yet, on target.'}
                  </p>
                  <Link href={x.kind === 'earn' ? '/solana' : '/solana/amplify'} className="mt-3 inline-block text-[13px] text-fg underline">
                    Manage
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </>
  );
}
