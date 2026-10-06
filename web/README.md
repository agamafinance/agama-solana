# web: the Agama app, on Solana

The production front of [app.agama.finance](https://app.agama.finance), in the same fork as the X Layer
build (same shell, same navbar, same cream panels on the green frame), with Solana devnet as its one
platform. Every page lives under `/solana`, so it can sit behind a path rewrite on app.agama.finance.

| Route | What it does |
|---|---|
| `/solana` | Earn: deposit a stock, pick the level on one slider, the agents hold it |
| `/solana/amplify` | One leverage slider, capped at 1 / (1 - LTV), open and close |
| `/solana/lend` | Supply and withdraw USDC in the pool the positions borrow from |
| `/solana/portfolio` | Every position of the wallet and what the agents last did |
| `/solana/faucet` | 10,000 USDC and 10 of each stock in one transaction |

```
lib/solana/
  config.ts          RPC, program id, PDAs, the four stocks
  useSolana.ts       one getMultipleAccounts snapshot, client-side accrual, instructions, send
  wallet.ts          Phantom, Solflare, Backpack, or any injected window.solana
  WalletProvider.tsx the wallet context
  idl.json           copied from ../idl/agama_solana.json
components/solana/   cards, rows, market picker, agents card
```

Reads are one `getMultipleAccounts` per refresh (protocol, markets, LP mint, and the wallet's eight
possible positions and six token accounts), decoded with the IDL and accrued forward to now with the
program's own rate model. Writes are signed with `signTransaction` and sent to devnet by the app, never
by the wallet, which would otherwise submit to whatever cluster it is set to.

## Honest about devnet

The stocks and USDC are stand-ins minted by the program. Prices are relayed by the keeper from the live
xStocks through Jupiter: the share price while NYSE trades, the token's own price outside it, when LTVs
drop by the 5% off-hours buffer. Swaps settle at that price minus 5 bps.

## Private balances

Every Agama mint is Token-2022 with confidential transfers. The Private tab (`/solana/private`) unlocks
the wallet's keys with one signature over `solana-conf-bal/v1` (kept in memory only), shows public and
decrypted private balances, and shields, unshields and sends privately. Earn, Amplify and Lend can take
what the public balance lacks out of the private one ("Unshield and deposit") and put what comes back
into it ("Return it to my private balance"). Proofs are built in the browser with `@solana/zk-sdk` and
every action is one wallet approval, even when it is 4 or 5 transactions. Entering or leaving the
protocol reveals the amount; positions are public program state.

## Run it

```bash
pnpm install
pnpm typecheck        # strict, over everything served (tsconfig.solana.json)
pnpm build && pnpm start          # http://127.0.0.1:3031/solana
NEXT_PUBLIC_SOLANA_RPC=...        # default https://rpc.magicblock.app/devnet
NEXT_PUBLIC_ASSET_PREFIX=...      # when served behind a rewrite

# A headless browser with an injected throwaway wallet: faucet, Earn open, every tab, Earn close.
PLAYWRIGHT_PATH=/path/to/node_modules/playwright CHROME_PATH=/path/to/chromium node scripts/ui-e2e.mjs

# The private run: unlock, shield, private send to a second wallet (decrypted on its side), Unshield and
# deposit into Earn, close back into the private balance, Unshield and supply. Needs a validator whose ZK
# ElGamal program takes the zk-sdk proofs (agave 4.3; 3.1 rejects them) and the devnet Token-2022.
PRIVATE=1 FUND_SOL=2 SOLANA_RPC=http://127.0.0.1:8899 node scripts/ui-e2e.mjs http://127.0.0.1:3032
```
