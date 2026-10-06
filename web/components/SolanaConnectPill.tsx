'use client';

import { useEffect, useRef, useState } from 'react';

import AnimatedButton from './AnimatedButton';
import { KNOWN_WALLETS } from '@/lib/solana/wallet';
import { useSolanaWallet } from '@/lib/solana/WalletProvider';
import { asset } from '@/lib/solana/config';

// Same pill as the other networks: dark-green AnimatedButton, address shortened
// and centred inside a "Connect Wallet" footprint so the navbar never reflows.
const pillProps = {
  variant: 'primary' as const,
  fillColor: 'rgba(20, 39, 31, 0.55)',
  borderColor: 'rgba(20, 39, 31, 0.55)',
  textRestColor: '#fff',
  textHoverColor: '#fff',
  className: 'h-10 px-[17px] text-[14px] font-medium whitespace-nowrap',
};

const shorten = (a: string) => `${a.slice(0, 4)}...${a.slice(-4)}`;

export function SolanaConnectPill() {
  const { address, connect, connectTo, disconnect, detected, pickerOpen, setPickerOpen, error, connecting } =
    useSolanaWallet();
  const box = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!pickerOpen) return;
    const onAway = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setPickerOpen(false);
    };
    document.addEventListener('mousedown', onAway);
    return () => document.removeEventListener('mousedown', onAway);
  }, [pickerOpen, setPickerOpen]);

  if (mounted && address) {
    return (
      <AnimatedButton {...pillProps} onClick={disconnect}>
        <span className="relative inline-block">
          <span className="invisible whitespace-nowrap">Connect Wallet</span>
          <span className="absolute inset-0 flex items-center justify-center whitespace-nowrap">
            {shorten(address.toBase58())}
          </span>
        </span>
      </AnimatedButton>
    );
  }

  // Offering to install a wallet beside one the user already has is noise:
  // the download links only show when nothing is installed.
  const missing = KNOWN_WALLETS.filter((w) => w.key !== 'solana');

  return (
    <div className="relative" ref={box}>
      <AnimatedButton {...pillProps} onClick={() => (pickerOpen ? setPickerOpen(false) : connect())}>
        Connect Wallet
      </AnimatedButton>

      {pickerOpen && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[232px] overflow-hidden rounded-2xl bg-[#fdfaf1] p-1.5 shadow-[0_1px_3px_rgba(20,50,35,0.10),0_16px_40px_rgba(20,50,35,0.22)]">
          {detected.map((w) => (
            <button
              key={w.key}
              type="button"
              disabled={connecting}
              onClick={() => connectTo(w)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14px] text-fg hover:bg-[#254839]/[0.07] disabled:opacity-50"
            >
              {w.icon ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={asset(w.icon)} alt="" className="h-6 w-6 shrink-0 rounded-full" />
              ) : (
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#254839] text-[11px] font-semibold text-[#fdf8ed]">
                  {w.label[0]}
                </span>
              )}
              {w.label}
            </button>
          ))}

          {detected.length === 0 &&
            missing.map((k) => (
              <a
                key={k.key}
                href={k.install}
                target="_blank"
                rel="noreferrer"
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] text-fg-muted hover:bg-[#254839]/[0.07]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={asset(k.icon ?? '')} alt="" className="h-6 w-6 shrink-0 rounded-full opacity-60" />
                {k.label}
                <span className="ml-auto text-[12px]">Install</span>
              </a>
            ))}

          <p className="px-3 pb-1.5 pt-1 text-[11px] text-fg-muted">Switch the wallet to devnet.</p>
          {error && <p className="px-3 py-2 text-[12px] text-fg-muted">{error}</p>}
        </div>
      )}
    </div>
  );
}
