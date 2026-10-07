'use client';

import { useState } from 'react';

import { usePrivate, PrivateActionError, type PublicLeft } from '@/lib/solana/PrivateContext';
import { tokenByMint } from '@/lib/solana/privateTokens';
import { useSolanaWallet } from '@/lib/solana/WalletProvider';
import { errorText } from '@/lib/solana/useSolana';
import { Status } from './ui';

const amountText = (l: PublicLeft) => {
  const t = tokenByMint(l.mint);
  return `${(Number(l.amount) / 10 ** t.decimals).toLocaleString('en-US', { maximumFractionDigits: t.decimals === 6 ? 2 : 4 })} ${t.label}`;
};

/// The privacy line at the top of every page: holdings are private, the keys
/// are unlocked for this session or not, and what the signature means.
export function PrivacyBar({ sol }: { sol?: number } = {}) {
  const { address } = useSolanaWallet();
  const { unlocked, unlocking, unlock, lock, balances, busy, shield, balancesError, balancesAt } = usePrivate();
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  if (!address) return null;
  const publicLeft: PublicLeft[] = (balances ?? []).filter((b) => b.public > 0n).map((b) => ({ mint: b.token.mint, amount: b.public }));
  const stale = balancesAt ? Math.floor((Date.now() - balancesAt) / 1000) : 0;
  return (
    <>
    {sol === 0 && (
      <div className="rounded-2xl border border-[#c98a2b]/40 bg-[#c98a2b]/10 px-4 py-3 text-[13px] text-fg" data-testid="devnet-notice">
        Agama runs on <b>Solana devnet</b> and this wallet has no devnet SOL for fees. In Phantom: Settings, Developer
        Settings, Testnet Mode on, then Solana Devnet. Get devnet SOL at{' '}
        <a href="https://faucet.solana.com" target="_blank" rel="noreferrer" className="underline">faucet.solana.com</a>{' '}
        for{' '}
        <button onClick={() => navigator.clipboard?.writeText(address.toBase58())} className="underline" title="Copy your address">
          {address.toBase58().slice(0, 4)}...{address.toBase58().slice(-4)} (copy)
        </button>
        , then open the Faucet tab.
      </div>
    )}
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-[#254839]/[0.05] px-4 py-3 text-[12px] text-fg-muted" data-testid="privacy-bar">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#254839] px-2.5 py-1 font-medium text-[#fdf8ed]">
        Private by default
      </span>
      {unlocked ? (
        <span>
          Your balances are encrypted on chain: only this wallet reads them.{' '}
          <button onClick={lock} className="underline hover:text-fg">
            Hide
          </button>
        </span>
      ) : unlocking ? (
        <span>Confirm the signature in your wallet to show your private balances (read only, it can never spend).</span>
      ) : (
        <span>
          Your balances are encrypted on chain.{' '}
          <button
            onClick={() => unlock().then(() => setErr('')).catch((e) => setErr(errorText(e)))}
            className="underline hover:text-fg"
          >
            Show them
          </button>{' '}
          with one signature: it reads, never spends.
        </span>
      )}
      {unlocked && publicLeft.length > 0 && (
        <button
          disabled={busy}
          onClick={() =>
            shield(publicLeft, (t) => setMsg(t))
              .then(() => setMsg('Done: everything is private again.'))
              .catch((e) => setMsg(errorText(e)))
          }
          className="underline hover:text-fg"
          data-testid="shield-public"
        >
          Shield {publicLeft.map(amountText).join(', ')} still public
        </button>
      )}
      {balancesError && <span className="text-[#b4571f]">Balances from {stale} s ago: the RPC is not answering, retrying.</span>}
      {(err || msg) && <span>{err || msg}</span>}
    </div>
    </>
  );
}

/// The result of an action, and when it stopped with funds left public, the
/// one-click way to put them back.
export function ActionStatus({ status, onDone }: { status?: { text: string; sig?: string; left?: PublicLeft[] }; onDone?: () => void }) {
  const { shield, busy } = usePrivate();
  const [note, setNote] = useState('');
  if (!status) return null;
  return (
    <div>
      <Status text={status.text} sig={status.sig} />
      {status.left && status.left.length > 0 && (
        <button
          disabled={busy}
          onClick={() =>
            shield(status.left!, (t) => setNote(t))
              .then(() => {
                setNote('Shielded: private again.');
                onDone?.();
              })
              .catch((e) => setNote(errorText(e)))
          }
          className="mt-2 text-[12px] font-medium text-fg underline"
          data-testid="shield-back"
        >
          Shield {status.left.map(amountText).join(' and ')} back
        </button>
      )}
      {note && <p className="mt-1 text-[12px] text-fg-muted">{note}</p>}
    </div>
  );
}

/// Turns an action error into the status line, keeping what was left public.
export function statusFromError(e: unknown): { text: string; left?: PublicLeft[] } {
  return { text: errorText(e), left: e instanceof PrivateActionError ? e.publicLeft : undefined };
}
