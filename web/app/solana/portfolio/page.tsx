'use client';

import Link from 'next/link';

import { TokenIcon } from '@/components/icons/TokenIcon';
import { AGENT_OPS, BPS, explorerAddr, usdcMint } from '@/lib/solana/config';
import { usePrivate } from '@/lib/solana/PrivateContext';
import { useSolanaWallet } from '@/lib/solana/WalletProvider';
import { ago, qty, usd, useSnapshot, type Position } from '@/lib/solana/useSolana';

const card = 'rounded-2xl bg-[#fdfaf1] shadow-[0_1px_3px_rgba(20,50,35,0.06),0_10px_30px_rgba(20,50,35,0.09)]';

export default function SolanaPortfolioPage() {
  const { address, connect } = useSolanaWallet();
  const { snap } = useSnapshot(address);
  const priv = usePrivate();

  const positions: Position[] = snap ? [...snap.earn, ...snap.amplify].filter((x): x is Position => !!x) : [];
  // What the wallet holds: the private balance plus any public remainder,
  // valued at the oracle. Unknown until the wallet has signed to read it.
  const held = (mint: Parameters<typeof priv.privateOf>[0], pub: bigint) => priv.privateOf(mint) + pub;
  const holdings = snap
    ? snap.markets
        .map((m) => {
          const amount = held(m.stock.stockMint, m.balance);
          return { m, amount, value: (amount * m.priceE8) / 10n ** 10n };
        })
        .filter((h) => h.amount > 0n)
    : [];
  const usdcHeld = snap ? held(usdcMint, snap.usdc) : 0n;
  // What the wallet would be worth if everything were unwound now: positions
  // (stock at the oracle plus the vault buffer, less debt) and the wallet.
  const inPositions = positions.reduce((a, x) => a + x.value + x.buffer - x.debt, 0n);
  const netWorth = inPositions + (priv.unlocked ? holdings.reduce((a, h) => a + h.value, usdcHeld) : 0n);
  const ready = !!snap;
  const addr = address?.toBase58();

  return (
    <section className="px-6 md:px-24 pt-10 md:pt-14 pb-24">
      <div className="max-w-[1400px] mx-auto">
        <h1 className="mt-2 text-[34px] text-fg font-semibold">Portfolio</h1>

        {!address ? (
          <div className={`mt-8 p-8 text-center ${card}`}>
            <p className="text-[15px] text-fg-muted">Connect your wallet to view your positions.</p>
            <button
              type="button"
              onClick={() => connect()}
              className="mt-4 h-11 rounded-full bg-[#254839] px-6 text-[14px] font-medium text-[#fdf8ed] hover:bg-[#1F3D31]"
            >
              Connect Wallet
            </button>
          </div>
        ) : (
          <>
            <div className={`mt-6 p-6 ${card}`}>
              <div className="text-[12px] uppercase tracking-wider text-fg-muted">Net worth</div>
              <div className="text-[34px] font-semibold tabular-nums text-fg">
                {ready ? usd(netWorth) : <span className="text-fg-muted/40">$0.00</span>}
              </div>
              <a
                href={explorerAddr(addr!)}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block break-all text-[12px] text-fg-muted underline-offset-2 hover:text-fg hover:underline"
              >
                {addr}
              </a>
              {!priv.unlocked && (
                <p className="mt-2 text-[12px] text-fg-muted">
                  Wallet balances are private: confirm the signature in your wallet to count them.
                </p>
              )}
            </div>

            <div className={`mt-4 space-y-3 transition-opacity duration-200 ${ready ? 'opacity-100' : 'opacity-0'}`}>
              {positions.map((x) => {
                const m = snap!.markets.find((mk) => mk.stock.symbol === x.stock.symbol)!;
                const hf = x.debt > 0n ? (Number(x.value * m.threshold) / Number(x.debt * BPS)).toFixed(2) : undefined;
                const what = x.kind === 'earn' ? 'Earn' : `Amplify ${(Number(x.leverageBps) / 10_000).toFixed(2)}x`;
                const agents = x.lastAgentOp ? ` · agents ${AGENT_OPS[x.lastAgentOp]}, ${ago(x.lastAgentAt)}` : '';
                return (
                  <Row
                    key={x.address.toBase58()}
                    icon={x.stock.ticker}
                    title={x.stock.ticker}
                    name={`${x.stock.name} · ${what} · ${x.debt > 0n ? `${usd(x.debt)} borrowed` : 'nothing borrowed'}${agents}`}
                    amount={qty(x.collateral, 2)}
                    sub={hf ? `${usd(x.value)} · health ${hf}` : usd(x.value)}
                    href={`${x.kind === 'earn' ? '/solana' : '/solana/amplify'}?s=${x.stock.symbol}`}
                  />
                );
              })}

              {priv.unlocked &&
                holdings.map((h) => (
                  <Row
                    key={h.m.stock.symbol}
                    icon={h.m.stock.ticker}
                    title={h.m.stock.ticker}
                    name={`${h.m.stock.name} · in your wallet, private`}
                    amount={qty(h.amount, 2)}
                    amountTestId={`held-${h.m.stock.symbol}`}
                    sub={usd(h.value)}
                    href={`/solana?s=${h.m.stock.symbol}`}
                  />
                ))}

              <Row
                icon="USDC"
                title="USDC"
                name={priv.unlocked ? 'Stand-in USDC · in your wallet, private' : 'Stand-in USDC · private'}
                amount={priv.unlocked ? usd(usdcHeld).replace('$', '') : '-'}
                amountTestId="held-USDC"
                sub={priv.unlocked ? usd(usdcHeld) : undefined}
                href="/solana/faucet"
              />

              {ready && positions.length === 0 && (!priv.unlocked || holdings.length === 0) && (
                <p className="rounded-2xl bg-[#fdfaf1] px-5 py-4 text-[14px] text-fg-muted shadow-[0_1px_3px_rgba(20,50,35,0.06)]">
                  No position yet. Get test tokens on the{' '}
                  <Link href="/solana/faucet" className="underline underline-offset-2">Faucet</Link>, then deposit a
                  stock on <Link href="/solana" className="underline underline-offset-2">Earn</Link> and the agents
                  take it from there.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function Row({
  icon, title, name, amount, amountTestId, sub, href,
}: { icon: string; title: string; name: string; amount: string; amountTestId?: string; sub?: string; href: string }) {
  return (
    <Link href={href} className="flex items-center gap-4 rounded-2xl bg-[#fdfaf1] px-5 py-4 shadow-[0_1px_3px_rgba(20,50,35,0.06)]">
      <TokenIcon symbol={icon} size={36} />
      <div className="min-w-0">
        <div className="text-[15px] font-medium text-fg">{title}</div>
        <div className="text-[13px] text-fg-muted">{name}</div>
      </div>
      <div className="ml-auto shrink-0 text-right">
        <div className="text-[16px] font-semibold tabular-nums text-fg" data-testid={amountTestId}>{amount}</div>
        {sub && <div className="text-[12px] text-fg-muted">{sub}</div>}
      </div>
    </Link>
  );
}
