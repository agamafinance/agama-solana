'use client';

import { useState } from 'react';

import { TokenIcon } from '@/components/icons/TokenIcon';
import { FAUCET_STOCK, FAUCET_USDC, STOCKS, usdcMint } from '@/lib/solana/config';
import { usePrivate, type PublicLeft } from '@/lib/solana/PrivateContext';
import { useSolanaWallet } from '@/lib/solana/WalletProvider';
import { ix, qty, usd, useSnapshot } from '@/lib/solana/useSolana';
import { ActionStatus, PrivacyBar, statusFromError } from '@/components/solana/privacy';
import { card, Hero, Panel, primaryBtn } from '@/components/solana/ui';

export default function SolanaFaucetPage() {
  const { address, provider, connect } = useSolanaWallet();
  const { snap, refresh } = useSnapshot(address);
  const priv = usePrivate();
  const busy = priv.busy;
  const [status, setStatus] = useState<{ text: string; sig?: string; left?: PublicLeft[] }>();

  async function claim() {
    if (!address || !provider) return setStatus({ text: 'Connect a wallet first.' });
    setStatus({ text: 'Building the transactions...' });
    try {
      // Eleven mints with their token accounts do not fit one transaction:
      // four per transaction. Then everything minted goes straight into the
      // private balance (setting it up the first time), all in one approval.
      const all = await ix.faucet(address);
      const ixGroups: typeof all[] = [];
      for (let i = 0; i < all.length; i += 4) ixGroups.push(all.slice(i, i + 4));
      const minted = [{ mint: usdcMint, amount: FAUCET_USDC }, ...STOCKS.map((s) => ({ mint: s.stockMint, amount: FAUCET_STOCK }))];
      const sigs = await priv.mintPrivately({ ixGroups, minted, progress: (text) => setStatus({ text }) });
      setStatus({ text: `Done. ${sigs.length} transactions, everything is in your private balance.`, sig: sigs[sigs.length - 1] });
    } catch (e) {
      setStatus(statusFromError(e));
    } finally {
      refresh();
    }
  }

  const priv_ = (mint: Parameters<typeof priv.privateOf>[0], pub: bigint) => (priv.unlocked ? priv.privateOf(mint) + pub : undefined);
  const rows = [
    {
      ticker: 'USDC',
      name: 'Stand-in USDC',
      get: usd(FAUCET_USDC, 0).replace('$', ''),
      have: snap ? (priv_(usdcMint, snap.usdc) === undefined ? 'locked' : usd(priv_(usdcMint, snap.usdc)).replace('$', '')) : '-',
    },
    ...STOCKS.map((s) => {
      const m = snap?.markets.find((x) => x.stock.symbol === s.symbol);
      const h = m ? priv_(s.stockMint, m.balance) : undefined;
      return {
        ticker: s.ticker,
        name: `${s.name}, stand-in`,
        get: qty(FAUCET_STOCK, 0),
        have: !snap ? '-' : h === undefined ? 'locked' : qty(h),
      };
    }),
  ];

  return (
    <>
      <Hero title={<>Faucet</>}>
        <p className="mt-4 max-w-[640px] text-[15px] text-fg-muted">
          Everything the app needs, in one approval: 10,000 USDC and 10 of each stock and of gold (XAUt0), devnet stand-ins
          minted by the Agama program and shielded straight into your private balance. About 15 transactions the
          first time (each private balance is set up once, with a proof), fewer after. Fees are in devnet SOL, from{' '}
          <a href="https://faucet.solana.com" target="_blank" rel="noreferrer" className="underline">faucet.solana.com</a>.
        </p>
      </Hero>
      <Panel>
        <PrivacyBar />
        <div className={`${card} max-w-[640px]`}>
          <table className="w-full text-[14px]">
            <thead>
              <tr className="text-left text-[12px] uppercase tracking-wider text-fg-muted">
                <th className="pb-2 font-normal">Token</th>
                <th className="pb-2 text-right font-normal">You get</th>
                <th className="pb-2 text-right font-normal">You hold, private</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.ticker} className="border-t border-[#254839]/10">
                  <td className="py-2.5">
                    <span className="flex items-center gap-2">
                      <TokenIcon symbol={r.ticker} size={22} />
                      <span className="font-medium text-fg">{r.ticker}</span>
                      <span className="text-[12px] text-fg-muted">{r.name}</span>
                    </span>
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-fg">{r.get}</td>
                  <td className="py-2.5 text-right tabular-nums text-fg-muted">{r.have}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {address && snap && snap.sol < 0.04 && (
            <p className="mt-3 text-[12px] text-[#b4571f]">
              {snap.sol.toFixed(4)} SOL in this wallet. The first claim opens eleven token accounts and their private
              balances (about 0.04 SOL of rent): top up at faucet.solana.com first.
            </p>
          )}
          <button onClick={address ? claim : () => connect()} disabled={busy} className={`mt-4 ${primaryBtn}`}>
            {!address ? 'Connect Wallet' : busy ? status?.text ?? 'Busy...' : 'Mint test tokens, privately'}
          </button>
          {!busy && <ActionStatus status={status} />}
        </div>
      </Panel>
    </>
  );
}
