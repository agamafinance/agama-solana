'use client';

import { ReactNode } from 'react';

import { NetworkProvider } from '@/lib/network/NetworkContext';
import { SolanaWalletProvider } from '@/lib/solana/WalletProvider';

/// One network, one provider. The Solana pages talk to the injected wallet
/// directly (Phantom, Solflare, Backpack), with no wallet-adapter tree.
export function Providers({ children }: { children: ReactNode }) {
  return (
    <NetworkProvider>
      <SolanaWalletProvider>{children}</SolanaWalletProvider>
    </NetworkProvider>
  );
}
