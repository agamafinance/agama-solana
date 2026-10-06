import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Solana',
  description: 'Deposit a tokenized stock, get more of it back. Agama on Solana devnet.',
};

export default function SolanaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
