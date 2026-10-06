'use client';

import { ReactNode } from 'react';

import { TokenIcon } from '@/components/icons/TokenIcon';
import { explorerTx } from '@/lib/solana/config';
import { ago, pct, px, qty, type Market } from '@/lib/solana/useSolana';

export const card =
  'rounded-2xl bg-[#fdfaf1] p-6 shadow-[0_1px_3px_rgba(20,50,35,0.06),0_10px_30px_rgba(20,50,35,0.09)]';
export const primaryBtn =
  'w-full rounded-full bg-[#254839] px-5 py-3.5 text-[15px] font-medium text-[#fdf8ed] transition-colors hover:bg-[#1F3D31] disabled:opacity-45';
export const secondaryBtn =
  'w-full rounded-full border border-[#254839]/25 px-5 py-3.5 text-[15px] font-medium text-fg transition-colors hover:bg-[#254839]/[0.06] disabled:opacity-45';

export function Hero({ title, children, art }: { title: ReactNode; children: ReactNode; art?: string }) {
  return (
    <section className="px-6 md:px-24 pt-10 md:pt-14 pb-8">
      <div className="max-w-[1400px] mx-auto relative">
        {art && (
          <div aria-hidden className="pointer-events-none absolute right-0 -top-2 z-20 hidden lg:block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={art} alt="" className="h-[300px] w-auto" />
          </div>
        )}
        <h1 className="mt-3 text-[34px] md:text-[44px] leading-[1.05] text-fg font-semibold">{title}</h1>
        {children}
      </div>
    </section>
  );
}

export function Panel({ children }: { children: ReactNode }) {
  return (
    <section className="vault-panel relative z-10 rounded-t-[20px] px-6 md:px-24 pt-10 md:pt-14 pb-24">
      <div className="max-w-[1400px] mx-auto space-y-5">{children}</div>
    </section>
  );
}

export function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-[12px] uppercase tracking-wider text-fg-muted">{label}</div>
      <div className="text-[26px] text-fg font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-[12px] text-fg-muted">{sub}</div>}
    </div>
  );
}

export function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-fg-muted">{label}</dt>
      <dd className="text-fg tabular-nums">{value}</dd>
    </div>
  );
}

/// A result line under the button that was pressed, with the explorer link
/// when there is a transaction to look at.
export function Status({ text, sig }: { text: string; sig?: string }) {
  if (!text) return null;
  return (
    <p className="mt-2 text-[12px] text-fg-muted" data-testid="status">
      {text}
      {sig && (
        <>
          {' '}
          <a href={explorerTx(sig)} target="_blank" rel="noreferrer" className="underline hover:text-fg">
            View on explorer
          </a>
        </>
      )}
    </p>
  );
}

export function MarketCards({
  markets, sel, onSelect, connected,
}: { markets: Market[]; sel: number; onSelect: (i: number) => void; connected: boolean }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {markets.map((m, i) => (
        <button
          key={m.stock.symbol}
          onClick={() => onSelect(i)}
          className={
            i === sel
              ? 'rounded-2xl bg-[#254839] p-4 text-left text-[#fdf8ed]'
              : 'rounded-2xl bg-[#fdfaf1] p-4 text-left text-fg transition-colors hover:bg-white'
          }
        >
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <TokenIcon symbol={m.stock.ticker} size={22} />
              <span className="text-[15px] font-medium">{m.stock.ticker}</span>
            </span>
            <span className="text-[11px] opacity-70">{m.stock.name}</span>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-[22px] font-semibold tabular-nums">{px(m.priceE8)}</span>
            {/* In session the price is the share's, out of it the xStock's own
                market on Solana. So its age is the honest thing to show. */}
            <span className="text-[11px] opacity-70">{ago(m.priceTime)}</span>
          </div>
          <div className="mt-1 text-[11px] opacity-70">
            Max LTV {pct(m.ltv)}
            {m.sessionOpen ? '' : ' off-hours'}
            {connected && m.balance > 0n ? ` · ${qty(m.balance, 2)} held` : ''}
          </div>
        </button>
      ))}
    </div>
  );
}

/// Where the prices come from: a Chainlink CRE workflow, its last report and
/// how many it has written. Honest about the forwarder it goes through.
export function CreBadge({ cre }: { cre: { simulation: boolean; reports: number; lastReportAt: number } | undefined }) {
  if (!cre) return null;
  const age = Math.max(0, Math.floor(Date.now() / 1000) - cre.lastReportAt);
  const ageText = cre.lastReportAt === 0 ? 'no report yet' : age < 90 ? `${age} s ago` : `${Math.round(age / 60)} min ago`;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-fg-muted" data-testid="cre-badge">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#375BD2]/10 px-2.5 py-1 font-medium text-[#375BD2]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#375BD2]" />
        Priced by Chainlink CRE
      </span>
      <span>
        Every minute the DON reads the xStocks on Jupiter and Orca&apos;s GLDY pool, agrees on the medians and writes a
        signed report. Last report {ageText}, {cre.reports.toLocaleString('en-US')} so far
        {cre.simulation ? ', relayed by the CRE simulator through Chainlink\'s devnet mock forwarder.' : ', through the Keystone Forwarder.'}
      </span>
    </div>
  );
}

export function SessionBadge({ m }: { m: Market | undefined }) {
  if (!m) return null;
  if (!m.fresh)
    return <span className="rounded-full bg-[#b4571f]/10 px-3 py-1 text-[12px] text-[#b4571f]">Stale price</span>;
  return m.sessionOpen ? (
    <span className="rounded-full bg-[#254839]/[0.06] px-3 py-1 text-[12px] text-fg">NYSE session</span>
  ) : (
    <span className="rounded-full bg-[#254839]/[0.06] px-3 py-1 text-[12px] text-fg">Off-hours, token price</span>
  );
}

export function AgentsCard({ children, last }: { children: ReactNode; last: string }) {
  return (
    <div className="mt-4 rounded-2xl border border-[#254839]/12 bg-white/60 p-4">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2" aria-hidden>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#254839] opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[#254839]" />
        </span>
        <span className="text-[13px] font-medium text-fg">Agents running</span>
      </div>
      <p className="mt-1.5 text-[13px] text-fg-muted">{children}</p>
      <p className="mt-2 text-[12px] text-fg-muted">{last}</p>
    </div>
  );
}

export function AmountBox({
  label, balanceLabel, onMax, value, onChange, unit, hint,
}: {
  label: string;
  balanceLabel: string;
  onMax: () => void;
  value: string;
  onChange: (v: string) => void;
  unit: ReactNode;
  hint?: string;
}) {
  return (
    <div className="mt-4 rounded-2xl border border-[#254839]/12 bg-white/60 p-4">
      <div className="flex items-center justify-between text-[12px] text-fg-muted">
        <span>{label}</span>
        <button onClick={onMax} className="hover:text-fg">
          Balance {balanceLabel} · Max
        </button>
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <input
          inputMode="decimal"
          placeholder="0.00"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent text-[28px] font-semibold text-fg tabular-nums outline-none placeholder:text-fg-muted/40"
        />
        <span className="shrink-0 rounded-full bg-[#254839]/[0.06] px-3 py-1.5 text-[14px] font-medium text-fg">
          {unit}
        </span>
      </div>
      {hint && <div className="mt-1 text-[12px] text-fg-muted">{hint}</div>}
    </div>
  );
}

/// Parse a decimal string into base units, or 0 when it is not a number.
export function parseAmount(s: string, decimals: number): bigint {
  const t = s.trim();
  if (!/^\d*\.?\d*$/.test(t) || t === '' || t === '.') return 0n;
  const [w, f = ''] = t.split('.');
  return BigInt(w || '0') * 10n ** BigInt(decimals) + BigInt((f + '0'.repeat(decimals)).slice(0, decimals) || '0');
}

export const toDecimal = (v: bigint, decimals: number) => {
  const s = v.toString().padStart(decimals + 1, '0');
  const f = s.slice(-decimals).replace(/0+$/, '');
  return f ? `${s.slice(0, -decimals)}.${f}` : s.slice(0, -decimals);
};
