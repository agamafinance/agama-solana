#!/usr/bin/env bash
# One run of a workflow on devnet (agama-prices by default, or agama-agents): the CRE simulator executes the workflow
# (HTTP + consensus + report signing) and broadcasts through Chainlink's mock
# forwarder into the Agama program. Keys come from .keys/ (never committed).
# Until the org has CRE Deploy Access, this is how the workflow runs; once it
# does, `cre workflow deploy agama-prices --target production-settings` moves
# it onto the DON and the live Keystone Forwarder.
set -eo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT/cre"
# The failover RPC proxy the simulation target points at (launchd keeps it up
# on this machine; start it here otherwise).
if ! curl -s -m 2 -o /dev/null http://127.0.0.1:8910; then
  nohup node "$ROOT/scripts/rpc-proxy.mjs" >/tmp/agama-rpc-proxy.log 2>&1 &
  sleep 1
fi
{
  echo "CRE_SOLANA_PRIVATE_KEY=$(node -e "console.log(require('$ROOT/node_modules/.pnpm/bs58@4.0.1/node_modules/bs58').encode(Buffer.from(require('$ROOT/.keys/cre-transmitter.json'))))")"
  echo "CRE_AGENT_KEY=$(node -e "console.log(require('$ROOT/node_modules/.pnpm/bs58@4.0.1/node_modules/bs58').encode(Buffer.from(require('$ROOT/.keys/cre-agent.json'))))")"
  echo "CRE_ETH_PRIVATE_KEY=$(head -1 "$ROOT/.keys/cre-owner.evm" | sed 's/^0x//')"
  # Data Streams credentials, if present
  if [ -f "$ROOT/.keys/datastreams.env" ]; then
    sed -n 's/^DATASTREAMS_API_KEY=/CRE_DS_KEY=/p; s/^DATASTREAMS_API_SECRET=/CRE_DS_SECRET=/p' "$ROOT/.keys/datastreams.env"
  fi
} > .env
chmod 600 .env
exec cre workflow simulate "${1:-agama-prices}" --target simulation-settings --broadcast --non-interactive --trigger-index 0
