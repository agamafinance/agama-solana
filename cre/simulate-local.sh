#!/usr/bin/env bash
# The CRE workflow end to end on a throwaway validator: Agama's program, devnet's
# Token-2022, and Chainlink's mock forwarder (program + state) cloned in. Then
# `cre workflow simulate --broadcast` writes real reports through the forwarder
# into `on_report`, and the market prices are read back.
#   VALIDATOR=/path/to/agave-4.3/bin/solana-test-validator ./cre/simulate-local.sh
set -eo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"
if lsof -nP -iTCP:8899 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "port 8899 is taken: another local validator is running (pkill -f solana-test-validator)" >&2
  exit 1
fi
: "${VALIDATOR:?set VALIDATOR to an agave 4.3+ solana-test-validator}"
L=$(mktemp -d)
ADMIN=$L/admin.json
TX=$L/transmitter.json
solana-keygen new --no-bip39-passphrase -s -o "$ADMIN" >/dev/null
solana-keygen new --no-bip39-passphrase -s -o "$TX" >/dev/null
CLONE=${CLONE_URL:-https://rpc.magicblock.app/devnet}
"$VALIDATOR" --reset --quiet --ledger "$L/ledger" --url "$CLONE" \
  --clone-upgradeable-program TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb \
  --clone-upgradeable-program 7kuEAA3mSC1Tz8gQjnvH7bKFda9xSPRRin9SZbH49cNK \
  --clone 5Tipz3yhTBdVsDbaBxZkrp7Gjf3brGq5SKkxReefPMP7 \
  --bpf-program 6YdZN72p68ynpGH1SwZ86EseFokch6zPAQPAq9NxPY7D target/deploy/agama_solana.so &
V=$!
trap 'kill $V 2>/dev/null; rm -rf "$L"' EXIT
export SOLANA_RPC=http://127.0.0.1:8899
until solana -u $SOLANA_RPC cluster-version >/dev/null 2>&1; do sleep 1; done
solana -u $SOLANA_RPC airdrop 100 "$(solana-keygen pubkey "$ADMIN")" >/dev/null
solana -u $SOLANA_RPC airdrop 10 "$(solana-keygen pubkey "$TX")" >/dev/null
echo "== setup"
CRE_TRANSMITTER=$(solana-keygen pubkey "$TX") ANCHOR_WALLET=$ADMIN ./node_modules/.bin/tsx scripts/setup.ts 2>&1 | grep -v "punycode\|trace-deprecation\|bigint" | grep -E "add_market|cre|done|Error" | head -20
echo "== cre workflow simulate --broadcast"
cd cre
cat > .env <<ENV
CRE_SOLANA_PRIVATE_KEY=$(node -e "const bs58=require('$ROOT/node_modules/.pnpm/bs58@4.0.1/node_modules/bs58');console.log(bs58.default?bs58.default.encode(Buffer.from(require('$TX'))):bs58.encode(Buffer.from(require('$TX'))))")
CRE_ETH_PRIVATE_KEY=0000000000000000000000000000000000000000000000000000000000000001
ENV
cat > project.local.yaml <<YAML
local-settings:
  rpcs:
    - chain-name: solana-devnet
      url: http://127.0.0.1:8899
YAML
cp project.yaml project.yaml.bak && grep -q "^local-settings:" project.yaml || cat project.local.yaml >> project.yaml
cp agama-prices/workflow.yaml agama-prices/workflow.yaml.bak
grep -q "^local-settings:" agama-prices/workflow.yaml || cat >> agama-prices/workflow.yaml <<YAML

local-settings:
  user-workflow:
    workflow-name: "agama-prices"
    deployment-registry: "private"
  workflow-artifacts:
    workflow-path: "./main.ts"
    config-path: "./config.simulation.json"
    secrets-path: ""
YAML
restore() { C="$ROOT/cre"; mv "$C/project.yaml.bak" "$C/project.yaml"; mv "$C/agama-prices/workflow.yaml.bak" "$C/agama-prices/workflow.yaml"; rm -f "$C/project.local.yaml"; }
trap 'restore; kill $V 2>/dev/null; rm -rf "$L"' EXIT
cre workflow simulate agama-prices --target local-settings --broadcast --non-interactive --trigger-index 0 2>&1 | grep -v "^\s*$" | tail -40
cd "$ROOT"
echo "== cre agents: prepare a position off target"
solana -u $SOLANA_RPC airdrop 5 "$(solana-keygen pubkey "$ROOT/.keys/cre-agent.json")" >/dev/null
./node_modules/.bin/tsx scripts/agents-cre-check.ts prepare 2>&1 | grep -v "punycode\|trace-deprecation\|bigint"
cd cre
B58=$(node -e "console.log(require('$ROOT/node_modules/.pnpm/bs58@4.0.1/node_modules/bs58').encode(Buffer.from(require('$ROOT/.keys/cre-agent.json'))))")
echo "CRE_AGENT_KEY=$B58" >> .env
sed 's#"rpcUrl": "[^"]*"#"rpcUrl": "http://127.0.0.1:8899"#' agama-agents/config.simulation.json > agama-agents/config.local.json
cp agama-agents/workflow.yaml agama-agents/workflow.yaml.bak
cat >> agama-agents/workflow.yaml <<YAML

local-settings:
  user-workflow:
    workflow-name: "agama-agents"
    deployment-registry: "private"
  workflow-artifacts:
    workflow-path: "./main.ts"
    config-path: "./config.local.json"
    secrets-path: "../secrets.yaml"
YAML
cre workflow simulate agama-agents --target local-settings --broadcast --non-interactive --trigger-index 0 2>&1 | grep -E "USER LOG|✗" || true
mv agama-agents/workflow.yaml.bak agama-agents/workflow.yaml; rm -f agama-agents/config.local.json
cd "$ROOT"
./node_modules/.bin/tsx scripts/agents-cre-check.ts verify "$ROOT/.keys/cre-agent.json" 2>&1 | grep -v "punycode\|trace-deprecation\|bigint"
echo "== on chain"
./node_modules/.bin/tsx scripts/state.ts 2>&1 | grep -E "^[A-Z]{3,5} " || true
