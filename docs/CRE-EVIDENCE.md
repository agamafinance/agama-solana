# CRE simulation evidence

Both workflows run through the CRE CLI (`cre workflow simulate --broadcast`),
with real HTTP fetches, DON consensus, report signing and Solana writes.
Reproduce: `./cre/run-devnet.sh agama-prices`, `./cre/run-devnet.sh agama-agents`
(devnet), `./cre/simulate-local.sh` (local validator, includes an agent action).

## 1. agama-prices on Solana devnet (7 Oct 2026, 14:27 UTC)

Chainlink Data Streams (overnight session for the shares, XAU/USDT x USDT/USD
for gold) checked against the xStock tokens, then a signed report written to the
Agama program through the forwarder:

- Report transaction: https://explorer.solana.com/tx/3w4s2gVSGdzQZzrD251yZHuPckXpkQeLzJioMpvNs2ZM3gS9a9viE18vYrdNiQvE4p23tqcqTUwgZnrNVcZ7rJyq?cluster=devnet
- Program: https://explorer.solana.com/address/6YdZN72p68ynpGH1SwZ86EseFokch6zPAQPAq9NxPY7D?cluster=devnet

```
✓ Workflow compiled
✓ Simulation limits enabled
2026-10-07T14:27:03Z [USER LOG] TSLA  378.48 off hours (Data Streams overnight, token Jupiter + DEX)
2026-10-07T14:27:03Z [USER LOG] NVDA  240.13 off hours (Data Streams overnight, token Jupiter + DEX)
2026-10-07T14:27:03Z [USER LOG] AAPL  333.74 off hours (Data Streams overnight, token Jupiter + DEX)
2026-10-07T14:27:03Z [USER LOG] SPY   779.25 off hours (Data Streams overnight, token Jupiter + DEX)
2026-10-07T14:27:03Z [USER LOG] QQQ   759.17 off hours (Data Streams overnight, token Jupiter + DEX)
2026-10-07T14:27:03Z [USER LOG] GOOGL 347.41 off hours (Data Streams overnight, token Jupiter + DEX)
2026-10-07T14:27:03Z [USER LOG] MSFT  529.44 off hours (Data Streams overnight, token Jupiter + DEX)
2026-10-07T14:27:03Z [USER LOG] AMZN  256.69 off hours (Data Streams overnight, token Jupiter + DEX)
2026-10-07T14:27:03Z [USER LOG] META  739.63 off hours (Data Streams overnight, token Jupiter + DEX)
2026-10-07T14:27:03Z [USER LOG] GLDY  4160.88 in session (Orca pool, Data Streams XAU)
2026-10-07T14:27:04Z [USER LOG] report GLDY -> 3w4s2gVSGdzQZzrD251yZHuPckXpkQeLzJioMpvNs2ZM3gS9a9viE18vYrdNiQvE4p23tqcqTUwgZnrNVcZ7rJyq
✓ Workflow Simulation Result:
│ Simulation complete! Ready to deploy your workflow?  │
{
  "markets": 10,
  "reports": [
    "3w4s2gVSGdzQZzrD251yZHuPckXpkQeLzJioMpvNs2ZM3gS9a9viE18vYrdNiQvE4p23tqcqTUwgZnrNVcZ7rJyq"
  ]
}
```

## 2. agama-agents on Solana devnet (same run)

```
✓ Workflow compiled
✓ Simulation limits enabled
2026-10-07T14:27:09Z [USER LOG] every position on target, nothing to send
✓ Workflow Simulation Result:
│ Simulation complete! Ready to deploy your workflow?  │
```

Every devnet position was on target, so the DON agreed on an empty plan.

## 3. Both workflows on a local validator, with an agent action

`simulate-local.sh` deploys the program, runs agama-prices (session prices
from Data Streams regular hours), moves a position off target and runs
agama-agents: the DON agrees on the plan, signs it deterministically and the
rebalance lands.

```
✓ Workflow compiled
✓ Simulation limits enabled
  HTTP: req=120kb resp=250kb timeout=10s | ConfHTTP: req=125kb resp=500kb timeout=1m30s | Consensus obs=25kb | ChainWrite evm_report=50kb evm_gas=10000000 solana_report=265b solana_cu=300000 | WASM binary=100mb compressed=20mb
  Binary hash: ef38ea399678c9f454f332a9a17d2432b2f39c842b41285376f87f1abb1f9762
  Config hash: b6587065acd6bd04ff44774c6a23df0fb63d8324c5e304e755fa1309f609880e
2026-10-07T01:22:11Z [SIMULATION] Simulator Initialized
2026-10-07T01:22:11Z [SIMULATION] Running trigger trigger=cron-trigger@1.0.0
2026-10-07T01:22:12Z [USER LOG] TSLA  380.51 in session (Data Streams regular, token Jupiter + DEX)
2026-10-07T01:22:12Z [USER LOG] NVDA  239.81 in session (Data Streams regular, token Jupiter + DEX)
2026-10-07T01:22:12Z [USER LOG] AAPL  332.38 in session (Data Streams regular, token Jupiter + DEX)
2026-10-07T01:22:12Z [USER LOG] SPY   779.20 in session (Data Streams regular, token Jupiter + DEX)
2026-10-07T01:22:12Z [USER LOG] QQQ   760.07 in session (Data Streams regular, token Jupiter + DEX)
2026-10-07T01:22:12Z [USER LOG] GOOGL 346.71 in session (Data Streams regular, token Jupiter + DEX)
2026-10-07T01:22:12Z [USER LOG] MSFT  531.90 in session (Data Streams regular, token Jupiter + DEX)
2026-10-07T01:22:12Z [USER LOG] AMZN  255.25 in session (Data Streams regular, token Jupiter + DEX)
2026-10-07T01:22:12Z [USER LOG] META  740.84 in session (Data Streams regular, token Jupiter + DEX)
2026-10-07T01:22:12Z [USER LOG] GLDY  4160.88 in session (Orca pool)
2026-10-07T01:22:13Z [USER LOG] report MSFT,AMZN,META -> JcE6CCMUo6c28oyuJoaKDKmERb163bA7sW666But2Q4b1diQ5u2TvAnY8bKmHmp3eDqMXon2v97PvJ2eTpb3JuB
✓ Workflow Simulation Result:
== cre agents: prepare a position off target
prepared: Earn 10 TSLA at 20%, then TSLA +10%
2026-10-07T01:22:21Z [USER LOG] rebalance 2jRQD9: 1 landed, 0 refused by preflight
PASS  CRE agent borrowed more (op 1, by A5aE6w16, agent A5aE6w16)
```
