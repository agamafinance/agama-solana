# Agama: make tokenized stocks productive on Solana

Deposit a tokenized stock, get more of it back. Live on **Solana devnet**.

The xStocks (TSLAx, NVDAx, AAPLx, SPYx, QQQx, GOOGLx, MSFTx, AMZNx, METAx) and
Tether Gold (XAUt0) are native tokens on Solana and trade around the
clock, yet a holder can only hold them. Agama turns
them into a position that grows: deposit the stock, the protocol borrows USDC
against it, puts the USDC to work in the Agama private credit vault, and
permissionless agents turn the yield back into **more of the stock**. What
grows is your share count, not a stablecoin balance.

## Try it

| | |
|---|---|
| Demo video | https://youtu.be/M5GXPA1J31w (2:22) |
| Live app | https://app.agama.finance/solana (Solana devnet; Phantom, Backpack or Solflare) |
| Program | [`6YdZN72p68ynpGH1SwZ86EseFokch6zPAQPAq9NxPY7D`](https://explorer.solana.com/address/6YdZN72p68ynpGH1SwZ86EseFokch6zPAQPAq9NxPY7D?cluster=devnet) on **devnet** |

**Try it without help.** Open the app with Phantom, Backpack or Solflare set to
devnet (a little devnet SOL from faucet.solana.com pays the fees), hit **Faucet** (USDC, the nine
stocks and XAUt0 land straight into your private balance), then **Earn**: pick a
stock, an amount and a level, deposit. Your position appears with its borrow,
its vault share and the agents keeping it on target; **Amplify** loops a stock
to a multiple; **Portfolio** decrypts your private balances on demand.

## Why Solana

- **The core logic is on chain, in one Anchor program.** Positions are PDAs
  seeded by owner, market and product; the lending pool, the private credit
  vault, borrowing, liquidation, bad debt and price bounds are all program
  rules. `earn_deposit` borrows and fills the vault in one instruction,
  `amplify_open` borrows and buys more of the same stock in one instruction.
- **Private by default, natively.** Every token is a Token-2022 mint with the
  confidential transfer extension: balances and transfer amounts are ElGamal
  ciphertexts, and the zero knowledge proofs are verified on chain by Solana's
  ZK ElGamal proof program. A stranger reads zero.
- **The assets are already here.** xStocks and gold tokens are native Token-2022
  tokens on Solana, trading around the clock. On mainnet the swap leg is a
  Jupiter route.
- **Agents need cheap, fast blocks.** `rebalance`, `compound` and `liquidate`
  are permissionless; at Solana fees and finality, keeping every position on
  target minute by minute is viable for anyone.
- **Tested like a program, not a demo.** 14 LiteSVM flows, end to end runs on a
  local validator and on devnet, and a browser end to end on the live app.

**What was built, and when.** The core of this repository (the Anchor program,
the Token-2022 confidential balance flows, the Data Streams integration, the web
app and the tests) was written on 6 and 7 October 2026, at TOKEN2049 Origins,
where it placed second on the Solana track. Since then: the always-on keeper and
its monitoring, and the price layer simplified to Data Streams read directly by
the keeper (the git history has every step). The first
commit lands the program and its tests in one piece (they were iterated
locally before the repository was created); the program's first transaction on
devnet is from 6 October, 05:00 UTC. The product design is not new: it is the one Agama shipped on
X Layer (EVM, Solidity) for OKX Dev Day,
[agamafinance/agama-xlayer](https://github.com/agamafinance/agama-xlayer). The
web app reuses Agama's visual identity and component styling from that app.

## Architecture

```mermaid
flowchart TB
    USER["Holder<br/>xStocks in a Solana wallet"]

    subgraph app["AGAMA APP"]
        EARN["Earn<br/>deposit the stock, get more stock"]
        AMP["Amplify<br/>loop the stock to the LTV ceiling"]
    end

    subgraph program["AGAMA PROGRAM (one Anchor program)"]
        POS["Position PDA<br/>one per owner, market and product<br/>the borrower of record"]
        MKT["Market PDA x10<br/>9 xStocks + XAUt0<br/>LTV, threshold, off-hours buffer, price"]
        POOL["Lending pool<br/>USDC, kinked rate, LP token"]
        VAULT["Agama private credit vault<br/>NAV per share, the Earn buffer"]
        PROTO["Protocol PDA<br/>signs for the pool, the vault,<br/>every custody and mint"]
    end

    subgraph price["THE PRICE LAYER: CHAINLINK DATA STREAMS"]
        DS["Chainlink Data Streams<br/>9 shares by session + XAU/USD"]
        KEEPER["Keeper, always on<br/>checks each price against<br/>the token on Jupiter + DEX"]
    end

    AGENTS["Agents<br/>the keeper, or anyone: permissionless"]
    LENDERS["USDC lenders"]

    USER --> app
    EARN --> POS
    AMP --> POS
    LENDERS --> POOL
    POS -->|"stock as collateral"| MKT
    POOL -->|"borrow USDC"| POS
    POS -->|"borrowed USDC"| VAULT
    AGENTS -->|"rebalance / compound / liquidate"| POS
    DS --> KEEPER
    KEEPER -->|"push_price, bounded"| MKT
    PROTO -.-> POOL
    PROTO -.-> VAULT

    classDef actor fill:#eff6ff,stroke:#2563eb,color:#1e40af
    classDef product fill:#f0fdf4,stroke:#22c55e,color:#15803d
    classDef core fill:#ffffff,stroke:#374151,color:#111827
    classDef oracle fill:#faf5ff,stroke:#a855f7,color:#7e22ce
    classDef bot fill:#fff7ed,stroke:#f97316,color:#c2410c

    class USER,LENDERS actor
    class EARN,AMP product
    class POS,MKT,POOL,VAULT,PROTO core
    class DS,KEEPER oracle
    class AGENTS bot
```

## What it does

- **Earn.** One deposit and one slider. The program borrows USDC up to the
  level you pick and puts it in the vault, in the same instruction. From then on
  the agents hold the level: the stock rises, they borrow the difference; it
  falls, they repay out of the vault shares, **never by selling your stock**.
  The yield above the debt is bought back as more stock (`compound`).
- **Amplify.** One slider. `amplify_open` borrows against the stock and buys
  more of the same stock in one instruction, no loop of hops: a loop at L times
  carries an LTV of `(L - 1) / L`, so the market's own LTV is the ceiling
  (1.43x on TSLA and NVDA, 1.54x on AAPL, 2x on SPY). The agents hold the
  multiple both ways.
- **Lend.** The pool is seeded by the protocol on devnet; the app no longer
  has a Lend tab, the `supply` / `withdraw` instructions remain.
- **The buffer goes before the liquidator.** `liquidate` first repays out of
  the position's vault shares; only if that does not restore health does the
  liquidator repay half the debt and take stock at a 5% bonus.
- **Priced around the clock, honestly.** Chainlink Data Streams, the xStocks'
  own data provider, price every market in its live session (regular, extended
  or overnight; see below). On weekends the price is the xStock token's own on
  Solana. Outside regular hours a market is flagged off-hours, so LTV and
  threshold both tighten by 5 points. A price moves 15% at most per
  update, publish times only move forward, and only a stale price stops a
  borrow.
- **No buttons for the automation.** Every position records which agent last
  acted, what it did and when. `rebalance`, `compound` and `liquidate` take any
  signer; the keeper is one caller among many.

### Solana, not a port line by line

On X Layer every user gets an EIP-1167 account contract and the routers call
into it. On Solana the account is a PDA (`position`, seeded by owner, market and
product), so there is nothing to clone and no router to trust: the owner's
signature derives the address. The X Layer `compoundIntoStock` needed the caller
to pass the exact swap amount and calldata, with an on-chain slippage floor
against griefing; here the swap is priced inside the instruction off the same
oracle, so an agent has nothing to choose and nothing to skim.

## Confidential balances

Every token Agama mints (USDC, the nine xStocks, XAUt0, the LP token) is a Token-2022
mint with the **confidential transfer extension**. A holder can move any of
them into an encrypted balance and send them to anyone without the amount ever
appearing on chain: balances and transfer amounts are ElGamal ciphertexts, and
the ZK proofs that keep them honest (no negative balances, no minted value)
are checked on chain by Solana's ZK ElGamal proof program.

| | Public | Private |
|---|---|---|
| What you hold of each token | | encrypted, only your keys read it |
| Sending to someone else | | amount hidden from everyone but the two of you |
| Depositing into Earn, Amplify | amount visible | |
| What comes back on close or withdraw | amount visible, then shielded again | |
| Positions (collateral, debt, target) | program state, readable by anyone | |

A program cannot price a loan it cannot read, so positions stay public: what
the encryption hides is everything around them, how much you hold, where it
goes, who you pay. The mints have no auditor key and no authority that could
add one later.

- **Keys.** Derived from one wallet signature over `solana-conf-bal/v1`, the
  standard every Token-2022 client uses, so the same wallet reads the same
  balances in any app.
- **Cost.** Shielding is one transaction (deposit and apply together, the new
  readable balance computed client-side; two the first time a token is set
  up). A private send is five and an unshield four: the range and equality proofs do not fit in one
  transaction, so they are verified into context accounts first and closed
  afterwards, rent back.
- **Rounding never reaches the wallet.** A holder whose USDC is all private has
  zero public USDC, so `earn_close` writes off a rounding gap of up to 0.0001
  USDC between the vault shares and the debt instead of asking the wallet for it.
- **Tooling.** Proofs come from `@solana/zk-sdk` (Anza's WASM build of
  `solana-zk-sdk`) through the Kit client `@solana-program/token-2022/confidential`.
  Local validators need agave 4.3 or later (3.1 rejects these proofs) and
  devnet's Token-2022 build (the genesis copy predates the instruction layout).

`pnpm private-e2e` runs it: shield, private sends, a stranger's view, unshield
into Earn, close and shield back, lend from private, every balance decrypted
and checked exactly.

## Prices and agents: Chainlink Data Streams

One keeper (`scripts/keeper.ts`) prices the markets and runs the agents. It
runs on GitHub Actions around the clock (`.github/workflows/fallback-keeper.yml`):
each job ticks every 30 seconds for almost six hours and queues the next one
before it starts.

```
every tick (30 s)
  Chainlink Data Streams  the 9 shares' regular, extended and overnight streams
                          (RWA Advanced v11), one HMAC-signed bulk request; the
                          marketStatus field picks the live session; XAU/USDT x
                          USDT/USD for gold (v3)
  Jupiter price API       each xStock and XAUt0: the token's own price, and the
                          share's last print
  DexScreener             the deepest pair of each token: a second, independent
                          token price (Raydium, Meteora...)
  gold spot               a guard on the gold reference
  push_price              every market that moved 0.3% or is 7 minutes old
  agents                  simulate rebalance and compound on every position,
                          send the ones that would do something
```

- **No single source decides.** A token price needs Jupiter and the DEX pair
  to agree within 2% (then their mean), or comes from the one that answered;
  if they disagree, the market keeps its last price.
- **Chainlink Data Streams lead.** Whenever a session is live (regular, pre,
  post or overnight, as the report's `marketStatus` says, never inferred from
  timestamps), the share price comes from Chainlink Data Streams, stamped with
  the report's observation time, provided the token agrees within 3%. Regular
  hours get the session terms, the extended sessions the off-hours ones.
  Weekends, when the streams are closed, fall back to the token. Gold is Data
  Streams XAU/USDT x USDT/USD when gold spot and XAUt0 agree with it within 3%.
  `scripts/datastreams-check.ts` prints the 29 reports on its own.
- **Bounded on chain.** `push_price` takes the keeper key. A publish time must
  be strictly newer than the last one and at most 15 s ahead. A move larger
  than 15% is not refused, which would freeze the market for good after an
  earnings gap: the price steps 15% toward it per update and converges.
- **Prices carry their source's time.** A Data Streams price is stamped with
  its observation, a share print with its own time; only a token price is
  stamped with the keeper's clock.
- **The agents are anyone.** `rebalance`, `compound` and `liquidate` take any
  signer; the keeper is one caller among many, and `pnpm keeper --agents-only`
  runs that half without any key.
- **Next: verify the reports on chain.** The program could take the signed
  Data Streams report and CPI Chainlink's Verifier on Solana, so a price is
  checked against the Data Streams DON's signatures instead of trusted from
  the keeper key.

## Where it lives

| | |
|---|---|
| Status | Live on devnet: Token-2022 with confidential balances, priced by Chainlink Data Streams, kept fresh by an always-on keeper. At each deploy the on-chain bytes were dumped and compared to the local build. |
| Program | [`6YdZN72p68ynpGH1SwZ86EseFokch6zPAQPAq9NxPY7D`](https://explorer.solana.com/address/6YdZN72p68ynpGH1SwZ86EseFokch6zPAQPAq9NxPY7D?cluster=devnet) (devnet) |
| Every address | [`deployments/devnet.json`](deployments/devnet.json) |
| IDL | [`idl/agama_solana.json`](idl/agama_solana.json) |
| Test funds | `faucet_usdc` mints 10,000 USDC, `faucet_stock` 10 shares of a market. Devnet SOL at https://faucet.solana.com |

## Devnet, said plainly

- **Stand-in tokens.** USDC, the nine xStocks and XAUt0 are mints the program
  controls, with a public faucet: no xStock or XAUt0 faucet exists on devnet.
  The prices are real: Data Streams, checked against the live tokens.
- **Built to stay up for anyone testing it.** On devnet every market's
  `max_age` is 7 days (mainnet: minutes): the always-on keeper reprices every
  few minutes, and if it ever stops, prices freeze instead of the app refusing
  every deposit. The keeper also refills the USDC pool when faucet collateral
  drains it, and an hourly health check (`.github/workflows/health.yml`) fails
  loudly if a price, a wallet or the app goes wrong.
- **Swaps settle at the oracle price minus 5 bps.** Devnet has no xStock
  liquidity. On mainnet that leg is a Jupiter route.
- **The vault's coupons are minted.** There is no credit book on devnet, so when
  the vault pays out more than it took in, the difference is minted and counted
  in `coupons_paid`. It is the only place the program creates dollars.
- **The session flag comes from Data Streams' `marketStatus`** (or the keeper's clock for gold and on weekends); the price is bounded.
- **Token-2022 throughout**, like the mainnet xStocks.
- **RPC failover.** Public devnet RPCs rate limit (429). The keeper fails over
  across `SOLANA_RPCS` (a keyed Helius endpoint, then MagicBlock's and Solana's
  own) and benches one that limited it for 30 s; the web app relays across
  three public endpoints (`web/lib/solana/rpc.ts`).

## Known limitations

Said plainly, for the judges and for the audit that comes after.

- **The price bound is per update, not per unit of time.** `apply_price`
  moves a price at most 15% per update, and an update only needs a newer
  publish time (at most 15 s ahead). Whoever holds the keeper key can stack updates with rising publish times in
  one transaction. Fix: store the on-chain time of the last update in the
  market and bound the move per minute. It needs a market account migration,
  so it is not in the hackathon build.
- **A capped price reads as fresh.** While a price converges after a gap
  larger than 15%, the market stores the capped value with the new publish
  time. Fix: a converging flag that pauses new borrows until it clears.
- **Devnet faucets are unlimited and borrowing has no per-market cap**, so
  anyone can borrow the pool dry with faucet collateral; the admin tops it up.
  Mainnet uses real tokens and needs debt ceilings per market.
- **The keeper key is hot** and its prices are trusted, within the bounds
  above, until the program verifies Data Streams reports on chain. With
  devnet's 7-day `max_age`, a keeper outage only freezes prices.
- **`initialize` is not tied to the upgrade authority** (it was called at
  deploy time); Earn liquidation repays the whole debt from the vault buffer;
  dust collateral left by a liquidation is not written off.
- **Mainnet porting:** real USDC is a classic SPL token while this program is
  Token-2022 only, and the real xStocks use the scaled UI amount extension, so
  amounts must be scaled after corporate actions.

## Run it

```bash
anchor build                      # or: cargo build-sbf --manifest-path programs/agama-solana/Cargo.toml
cargo test                        # 14 LiteSVM flows
./scripts/check.sh                # everything CI runs, before pushing
pnpm install
pnpm setup                        # initialize, 10 markets, first prices, seed the pool (idempotent)
pnpm e2e                          # 9 real transactions on devnet from a fresh wallet
pnpm e2e:local                    # throwaway validator: setup, the e2e, the agents through
                                  # the real keeper with prices moved on purpose (17 checks),
                                  # then the private path (12 checks). VALIDATOR=agave 4.3+
pnpm state                        # live pool, vault, prices and their age, positions, keeper
pnpm keeper                       # the keeper: Data Streams prices and the agents
pnpm tsx scripts/datastreams-check.ts  # the latest Data Streams report of every feed
```

The LiteSVM suite (`programs/agama-solana/tests/flows.rs`) covers: Earn opening
at the level with the USDC landing in the vault; the agents holding the level
both ways without touching the stock; half a year of yield coming back as more
stock and a close returning it; a close after interest outran the yield taking
the shortfall from the wallet; Amplify looping to the multiple, holding it
through a rally and a drop, and unwinding; the buffer going before the
liquidator; an Amplify loop liquidated at the bonus; lenders earning the rate
and not withdrawing lent cash; the price bounds (keeper only, 15% per push,
publish time, staleness, off-hours terms); the slider.

## The app

`web/` is the Agama app with Solana as its platform: Portfolio, Earn, Amplify
and a Faucet under `/solana`, for Phantom, Solflare, Backpack or any injected
wallet. **Private by default**: one signature unlocks the confidential keys,
the faucet's tokens are shielded as they land, a deposit unshields exactly
what it needs right before it, and whatever a close returns is shielded again.
`cd web && pnpm dev` serves it on http://localhost:3031/solana.
`web/scripts/ui-e2e.mjs` drives it in a headless browser with a throwaway
signer, every click a real devnet transaction.

## Instructions

| | Who | What |
|---|---|---|
| `initialize`, `add_market`, `set_params`, `set_market` | admin | Protocol, mints, pool and vault accounts; markets and their terms |
| `push_price` | keeper | A market's price, from Data Streams; bounded |
| `faucet_usdc`, `faucet_stock` | anyone | Devnet funds |
| `supply`, `withdraw` | lender | USDC in and out of the pool, LP token |
| `earn_deposit`, `earn_set_target`, `earn_close` | owner | Open or top up at a level, move the slider, close |
| `amplify_open`, `amplify_close` | owner | Loop to a multiple in one instruction, unwind |
| `rebalance`, `compound`, `liquidate`, `poke` | anyone | The agents |
