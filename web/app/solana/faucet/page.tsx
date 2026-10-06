'use client';

import { useState } from 'react';

import { TokenIcon } from '@/components/icons/TokenIcon';
import { FAUCET_STOCK, FAUCET_USDC, STOCKS } from '@/lib/solana/config';
import { useSolanaWallet } from '@/lib/solana/WalletProvider';
import { errorText, ix, qty, sendBatch, usd, useSnapshot } from '@/lib/solana/useSolana';
import { card, Hero, Panel, primaryBtn, Status } from '@/components/solana/ui';

export default function SolanaFaucetPage() {
  const { address, provider, connect } = useSolanaWallet();
  const { snap, refresh } = useSnapshot(address);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ text: string; sig?: string }>();

  async function claim() {
    if (!address || !provider) return;
    setBusy(true);
    setStatus({ text: 'Minting...' });
    try {
      // Eleven mints with their token accounts do not fit one transaction:
      // four per transaction, approved once.
      const all = await ix.faucet(address);
      const groups: typeof all[] = [];
      for (let i = 0; i < all.length; i += 4) groups.push(all.slice(i, i + 4));
      setStatus({ text: `Minting, ${groups.length} transactions in one approval...` });
      const sigs = await sendBatch(provider, address, groups);
      setStatus({ text: `Done. ${sigs.length} transactions.`, sig: sigs[sigs.length - 1] });
      refresh();
    } catch (e) {
      setStatus({ text: errorText(e) });
    } finally {
      setBusy(false);
    }
  }

  const rows = [
    { ticker: 'USDC', name: 'Stand-in USDC', get: usd(FAUCET_USDC, 0).replace('$', ''), have: snap ? usd(snap.usdc).replace('$', '') : '-' },
    ...STOCKS.map((s, i) => ({
      ticker: s.ticker,
      name: `${s.name}, stand-in`,
      get: qty(FAUCET_STOCK, 0),
      have: snap ? qty(snap.markets[i].balance) : '-',
    })),
  ];

  return (
    <>
      <Hero title={<>Faucet</>}>
        <p className="mt-4 max-w-[640px] text-[15px] text-fg-muted">
          Everything the app needs, in one transaction: 10,000 USDC and 10 shares of each stock, all devnet stand-ins
          minted by the Agama program. The fee is paid in devnet SOL, from{' '}
          <a href="https://faucet.solana.com" target="_blank" rel="noreferrer" className="underline">faucet.solana.com</a>.
        </p>
      </Hero>
      <Panel>
        <div className={`${card} max-w-[640px]`}>
          <table className="w-full text-[14px]">
            <thead>
              <tr className="text-left text-[12px] uppercase tracking-wider text-fg-muted">
                <th className="pb-2 font-normal">Token</th>
                <th className="pb-2 text-right font-normal">You get</th>
                <th className="pb-2 text-right font-normal">You hold</th>
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
          {address && snap && snap.sol < 0.01 && (
            <p className="mt-3 text-[12px] text-[#b4571f]">
              {snap.sol.toFixed(4)} SOL in this wallet. The first claim opens five token accounts (about 0.01 SOL of
              rent): top up at faucet.solana.com first.
            </p>
          )}
          <button onClick={address ? claim : () => connect()} disabled={busy} className={`mt-4 ${primaryBtn}`}>
            {!address ? 'Connect Wallet' : busy ? status?.text : 'Mint test tokens'}
          </button>
          {!busy && status && <Status text={status.text} sig={status.sig} />}
        </div>
      </Panel>
    </>
  );
}
