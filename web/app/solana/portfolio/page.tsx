'use client';

import Link from 'next/link';

import { TokenIcon } from '@/components/icons/TokenIcon';
import { AGENT_OPS, BPS, explorerAddr } from '@/lib/solana/config';
import { useSolanaWallet } from '@/lib/solana/WalletProvider';
import { ago, pct, qty, totalAssets, usd, useSnapshot, type Position } from '@/lib/solana/useSolana';
import { card, Hero, Panel, primaryBtn, Stat } from '@/components/solana/ui';

export default function SolanaPortfolioPage() {
  const { address, connect } = useSolanaWallet();
  const { snap } = useSnapshot(address);

  const positions: Position[] = snap ? [...snap.earn, ...snap.amplify].filter((x): x is Position => !!x) : [];
  const lpValue = snap && snap.protocol.lpSupply > 0n ? (snap.lp * totalAssets(snap.protocol)) / snap.protocol.lpSupply : 0n;
  const equity = positions.reduce((a, x) => a + x.value + x.buffer - x.debt, 0n);
  const wallet = snap
    ? snap.markets.reduce((a, m) => a + (m.balance * m.priceE8) / 10n ** 10n, snap.usdc)
    : 0n;

  return (
    <>
      <Hero title={<>Portfolio</>}>
        <p className="mt-4 max-w-[640px] text-[15px] text-fg-muted">
          Every position this wallet holds on Agama for Solana, and what the agents last did to each.
        </p>
        {address && (
          <div className="mt-7 flex flex-wrap gap-8">
            <Stat label="In positions" value={usd(equity)} sub="Stock plus vault buffer, less debt" />
            <Stat label="Lending" value={usd(lpValue)} sub="USDC pool" />
            <Stat label="In the wallet" value={usd(wallet)} sub="USDC and stocks at the oracle" />
          </div>
        )}
      </Hero>
      <Panel>
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
