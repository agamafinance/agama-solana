// The tokens a holder can keep private, and the shapes the confidential layer
// hands back. Kept apart from confidential.ts so pages can import them without
// pulling the zk-sdk WASM into the server render.
import type { PublicKey } from '@solana/web3.js';
import type { AeKey, ElGamalKeypair, ElGamalSecretKey } from '@solana/zk-sdk';

import { STOCK_DECIMALS, STOCKS, USDC_DECIMALS, usdcMint } from './config';

export type Keys = { elgamal: ElGamalKeypair; secret: ElGamalSecretKey; ae: AeKey };

export type PrivToken = { key: string; label: string; mint: PublicKey; decimals: number };
export const PRIVATE_TOKENS: PrivToken[] = [
  { key: 'USDC', label: 'USDC', mint: usdcMint, decimals: USDC_DECIMALS },
  ...STOCKS.map((s) => ({ key: s.symbol, label: s.ticker, mint: s.stockMint, decimals: STOCK_DECIMALS })),
];
export const tokenByMint = (mint: PublicKey) => PRIVATE_TOKENS.find((t) => t.mint.equals(mint))!;

export type Balance = {
  token: PrivToken;
  exists: boolean;
  configured: boolean;
  public: bigint;
  /// Undefined while locked.
  private?: bigint;
  pending?: bigint;
};

export type { Progress } from './batch';
