# CRE simulation evidence

Both workflows are **Confidential Workflows**: their handler runs in a TEE
(`handlerInTee`, AWS Nitro). Inside the enclave, agama-prices reads the
Chainlink Data Streams API key and secret, signs the request and decodes the
reports; agama-agents reads the agent key and signs the agreed transactions.
Neither credential ever reaches a DON node. Everything public (reading the
chain and public prices with median or identical consensus, signing the
report, writing to Solana) goes through the DONs via `usingTheDons()`.

They run through the CRE CLI simulator (`cre workflow simulate --broadcast`):
the TEE and the DON are simulated (the CLI says so below), the HTTP fetches,
the report and the Solana writes are real. The reports reach the program
through Chainlink's devnet mock forwarder; the production config points at the
Keystone Forwarder. The CLI prints log times in local time (UTC+8) with a Z
suffix: 15:47:54 in the logs is 07:47:54 UTC, the transaction's block time. Reproduce:
`./cre/run-devnet.sh agama-prices`, `./cre/run-devnet.sh agama-agents`
(devnet), `./cre/simulate-local.sh` (local validator, includes an agent action).

## 1. agama-prices on Solana devnet (7 Oct 2026, 07:47 UTC)

Data Streams (overnight session for the shares, XAU/USDT x USDT/USD for gold)
read in the enclave, checked against the xStock tokens and the Orca pool agreed
by the DON, then a signed report written to the Agama program through the
forwarder:

- Report transaction: https://explorer.solana.com/tx/2uzp2YfeoBrctTT8QLnJz96APhrqMQGraxK8baSnYDondFXhPRL5QxiCC6efFPBshFh4pzyYmUz6ZBkv85FZqnzG?cluster=devnet
- Program: https://explorer.solana.com/address/6YdZN72p68ynpGH1SwZ86EseFokch6zPAQPAq9NxPY7D?cluster=devnet

```
✓ Workflow compiled
✓ Simulation limits enabled
│ Trigger requested TEE Execution your trigger will run in one of the following Tees:                │
│     - AWS Nitro in us-west-2                                                                       │
│ The simulator is not a real TEE, and is meant to debug.                                            │
2026-10-07T15:47:54Z [USER LOG] TSLA  378.59 off hours (Data Streams overnight, token Jupiter + DEX)
2026-10-07T15:47:54Z [USER LOG] NVDA  240.04 off hours (Data Streams overnight, token Jupiter + DEX)
2026-10-07T15:47:54Z [USER LOG] AAPL  334.03 off hours (Data Streams overnight, token Jupiter + DEX)
2026-10-07T15:47:54Z [USER LOG] SPY   779.18 off hours (Data Streams overnight, token Jupiter + DEX)
2026-10-07T15:47:54Z [USER LOG] QQQ   758.79 off hours (Data Streams overnight, token Jupiter + DEX)
2026-10-07T15:47:54Z [USER LOG] GOOGL 347.50 off hours (Data Streams overnight, token Jupiter + DEX)
2026-10-07T15:47:54Z [USER LOG] MSFT  530.27 off hours (Data Streams overnight, token Jupiter + DEX)
2026-10-07T15:47:54Z [USER LOG] AMZN  256.99 off hours (Data Streams overnight, token Jupiter + DEX)
2026-10-07T15:47:54Z [USER LOG] META  740.44 off hours (Data Streams overnight, token Jupiter + DEX)
2026-10-07T15:47:54Z [USER LOG] GLDY  4160.88 in session (Orca pool, Data Streams XAU)
2026-10-07T15:47:55Z [USER LOG] report GLDY -> 2uzp2YfeoBrctTT8QLnJz96APhrqMQGraxK8baSnYDondFXhPRL5QxiCC6efFPBshFh4pzyYmUz6ZBkv85FZqnzG
✓ Workflow Simulation Result:
│ Simulation complete! Ready to deploy your workflow?  │
{
  "markets": 10,
  "reports": [
    "2uzp2YfeoBrctTT8QLnJz96APhrqMQGraxK8baSnYDondFXhPRL5QxiCC6efFPBshFh4pzyYmUz6ZBkv85FZqnzG"
  ]
}
```

## 2. agama-agents on Solana devnet (same minute)

```
✓ Workflow compiled
✓ Simulation limits enabled
│ Trigger requested TEE Execution your trigger will run in one of the following Tees:                │
│     - AWS Nitro in us-west-2                                                                       │
2026-10-07T15:48:00Z [USER LOG] every position on target, nothing to send
✓ Workflow Simulation Result:
│ Simulation complete! Ready to deploy your workflow?  │
```

Every devnet position was on target, so the DON agreed on an empty plan.

## 3. Both workflows on a local validator, with an agent action

`simulate-local.sh` deploys the program, runs agama-prices, moves a position
off target and runs agama-agents: the DON agrees on the plan, the enclave signs
it and the rebalance lands.

```
== cre workflow simulate --broadcast
✓ Simulation limits enabled
  HTTP: req=120kb resp=250kb timeout=10s | ConfHTTP: req=125kb resp=500kb timeout=1m30s | Consensus obs=25kb | ChainWrite evm_report=50kb evm_gas=10000000 solana_report=265b solana_cu=300000 | WASM binary=100mb compressed=20mb
  Binary hash: 6c81b5ae415762a56fc1526d5b238260ecf6cf76ce6a93810b6a71f8d02d148a
  Config hash: b6587065acd6bd04ff44774c6a23df0fb63d8324c5e304e755fa1309f609880e
2026-10-07T15:48:32Z [SIMULATION] Simulator Initialized
2026-10-07T15:48:32Z [SIMULATION] Running trigger trigger=cron-trigger@1.0.0
╭────────────────────────────────────────────────────────────────────────────────────────────────────╮
│ Trigger requested TEE Execution your trigger will run in one of the following Tees:                │
│     - AWS Nitro in us-west-2                                                                       │
│ The simulator is not a real TEE, and is meant to debug.                                            │
│ Do not use it for sensitive information.                                                           │
│ During real execution, user logs for this trigger will not be visible, and will not leave the TEE. │
│ They are presented in the simulator for debugging only.                                            │
│                                                                                                    │
╰────────────────────────────────────────────────────────────────────────────────────────────────────╯
2026-10-07T15:48:35Z [USER LOG] TSLA  378.59 off hours (Data Streams overnight, token Jupiter + DEX)
2026-10-07T15:48:35Z [USER LOG] NVDA  240.04 off hours (Data Streams overnight, token Jupiter + DEX)
2026-10-07T15:48:35Z [USER LOG] AAPL  334.03 off hours (Data Streams overnight, token Jupiter + DEX)
2026-10-07T15:48:35Z [USER LOG] SPY   779.08 off hours (Data Streams overnight, token Jupiter + DEX)
2026-10-07T15:48:35Z [USER LOG] QQQ   758.59 off hours (Data Streams overnight, token Jupiter + DEX)
2026-10-07T15:48:35Z [USER LOG] GOOGL 347.50 off hours (Data Streams overnight, token Jupiter + DEX)
2026-10-07T15:48:35Z [USER LOG] MSFT  530.27 off hours (Data Streams overnight, token Jupiter + DEX)
2026-10-07T15:48:35Z [USER LOG] AMZN  256.99 off hours (Data Streams overnight, token Jupiter + DEX)
2026-10-07T15:48:35Z [USER LOG] META  740.49 off hours (Data Streams overnight, token Jupiter + DEX)
2026-10-07T15:48:35Z [USER LOG] GLDY  4160.88 in session (Orca pool, Data Streams XAU)
2026-10-07T15:48:36Z [USER LOG] report TSLA,NVDA,AAPL -> Y5oHdvVmCfueJdj5D6b53UNpTd1WiR3T76Xz2MhtGzehty5tjDCwnJbmyTyb5P2ZCetT52MDLESVaNtovyvCky3
✓ Workflow Simulation Result:
== cre agents: prepare a position off target
prepared: Earn 10 TSLA at 20%, then TSLA +10%
│     - AWS Nitro in us-west-2                                                                       │
2026-10-07T15:48:44Z [USER LOG] rebalance A4sVrb: 1 landed, 0 refused by preflight
PASS  CRE agent borrowed more (op 1, by A5aE6w16, agent A5aE6w16)
```
