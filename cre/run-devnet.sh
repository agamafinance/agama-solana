#!/usr/bin/env bash
# One run of agama-prices on devnet: the CRE simulator executes the workflow
# (HTTP + consensus + report signing) and broadcasts through Chainlink's mock
# forwarder into the Agama program. Keys come from .keys/ (never committed).
# Until the org has CRE Deploy Access, this is how the workflow runs; once it
# does, `cre workflow deploy agama-prices --target production-settings` moves
# it onto the DON and the live Keystone Forwarder.
set -eo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT/cre"
{
  echo "CRE_SOLANA_PRIVATE_KEY=$(node -e "console.log(require('$ROOT/node_modules/.pnpm/bs58@4.0.1/node_modules/bs58').encode(Buffer.from(require('$ROOT/.keys/cre-transmitter.json'))))")"
  echo "CRE_ETH_PRIVATE_KEY=$(head -1 "$ROOT/.keys/cre-owner.evm" | sed 's/^0x//')"
} > .env
chmod 600 .env
exec cre workflow simulate agama-prices --target simulation-settings --broadcast --non-interactive --trigger-index 0
