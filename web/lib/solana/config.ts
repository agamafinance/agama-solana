import { PublicKey } from '@solana/web3.js';
import { TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddressSync } from '@solana/spl-token';

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

export const protocolPda = pda(enc('protocol.v2'));
/// Where the Chainlink CRE receiver keeps its forwarder and report count.
export const crePda = pda(enc('cre.v2'));
export const usdcMint = pda(enc('usdc.v2'));
export const lpMint = pda(enc('lp.v2'));
export const poolUsdc = pda(enc('pool_usdc.v2'));
export const vaultUsdc = pda(enc('vault_usdc.v2'));

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

/// The xStocks keep their `x` ticker; GLDY is Streamex's gold-backed token,
/// about one ounce each, priced off Orca's GLDY/USDC pool.
export const STOCKS: Stock[] = [
  ['TSLA', 'Tesla'],
  ['NVDA', 'NVIDIA'],
  ['AAPL', 'Apple'],
  ['SPY', 'S&P 500 ETF'],
  ['QQQ', 'Nasdaq 100 ETF'],
  ['GOOGL', 'Alphabet'],
  ['MSFT', 'Microsoft'],
  ['AMZN', 'Amazon'],
  ['META', 'Meta'],
  ['GLDY', 'Gold, Streamex', 'GLDY'],
].map(([symbol, name, ticker]) => {
  const stockMint = pda(enc('stock.v2'), symbolBytes(symbol));
  const market = pda(enc('market.v2'), stockMint.toBytes());
  const custody = pda(enc('custody.v2'), market.toBytes());
  return { symbol, ticker: ticker ?? `${symbol}x`, name, stockMint, market, custody };
});

export type Kind = 'earn' | 'amplify';

export const positionPda = (owner: PublicKey, market: PublicKey, kind: Kind) =>
  pda(enc('position.v2'), owner.toBytes(), market.toBytes(), enc(kind));

/// Every Agama mint is Token-2022, with the confidential transfer extension.
export const TOKEN_PROGRAM = TOKEN_2022_PROGRAM_ID;
export const ata = (owner: PublicKey, mint: PublicKey) =>
  getAssociatedTokenAddressSync(mint, owner, true, TOKEN_2022_PROGRAM_ID);

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
