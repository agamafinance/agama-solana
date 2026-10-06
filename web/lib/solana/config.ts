import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';

import idl from './idl.json';

/// The public devnet RPC rate-limits hard enough to break a page that reads a
/// dozen accounts on mount. MagicBlock's devnet endpoint fronts the same cluster.
export const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://rpc.magicblock.app/devnet';
export const PROGRAM_ID = new PublicKey(idl.address);
export const asset = (path: string) => `${process.env.NEXT_PUBLIC_ASSET_PREFIX ?? ''}${path}`;
export const explorerTx = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
export const explorerAddr = (a: string) => `https://explorer.solana.com/address/${a}?cluster=devnet`;

export const BPS = 10_000n;
export const WAD = 10n ** 18n;
export const YEAR = 365n * 24n * 3600n;
export const USDC_DECIMALS = 6;
export const STOCK_DECIMALS = 8;
/// stock (1e8) * price (1e8) / 1e10 = USDC (1e6)
export const VALUE_SCALE = 10n ** 10n;
export const FAUCET_USDC = 10_000n * 1_000_000n;
export const FAUCET_STOCK = 10n * 100_000_000n;

const enc = (s: string) => new TextEncoder().encode(s);
const pda = (...seeds: Uint8Array[]) => PublicKey.findProgramAddressSync(seeds, PROGRAM_ID)[0];

export const protocolPda = pda(enc('protocol'));
export const usdcMint = pda(enc('usdc'));
export const lpMint = pda(enc('lp'));
export const poolUsdc = pda(enc('pool_usdc'));
export const vaultUsdc = pda(enc('vault_usdc'));

function symbolBytes(sym: string): Uint8Array {
  const b = new Uint8Array(8);
  b.set(enc(sym));
  return b;
}

export interface Stock {
  symbol: string;
  /// The name the xStock goes by, which is also the icon key.
  ticker: string;
  name: string;
  stockMint: PublicKey;
  market: PublicKey;
  custody: PublicKey;
}

export const STOCKS: Stock[] = [
  ['TSLA', 'Tesla'],
  ['NVDA', 'NVIDIA'],
  ['AAPL', 'Apple'],
  ['SPY', 'S&P 500 ETF'],
].map(([symbol, name]) => {
  const stockMint = pda(enc('stock'), symbolBytes(symbol));
  const market = pda(enc('market'), stockMint.toBytes());
  const custody = pda(enc('custody'), market.toBytes());
  return { symbol, ticker: `${symbol}x`, name, stockMint, market, custody };
});

export type Kind = 'earn' | 'amplify';

export const positionPda = (owner: PublicKey, market: PublicKey, kind: Kind) =>
  pda(enc('position'), owner.toBytes(), market.toBytes(), enc(kind));

export const ata = (owner: PublicKey, mint: PublicKey) => getAssociatedTokenAddressSync(mint, owner);

/// What an agent last did to a position, as the program records it.
export const AGENT_OPS: Record<number, string> = {
  1: 'borrowed more into the vault',
  2: 'repaid from the yield',
  3: 'bought more stock with the yield',
  4: 'repaid from the yield before any stock was sold',
  5: 'liquidated part of the position',
  6: 'bought more stock to hold the multiple',
  7: 'sold a little stock to hold the multiple',
};
