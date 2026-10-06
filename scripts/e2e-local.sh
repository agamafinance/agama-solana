#!/usr/bin/env bash
# Everything end to end on a throwaway local validator: setup, the user e2e,
# then the agents through the real keeper process with prices moved on purpose,
# then the private path (confidential balances).
#
# The private path needs a validator whose ZK ElGamal proof program matches the
# proofs @solana/zk-sdk builds: agave 3.1 rejects them, 4.3 (mainnet) accepts.
#   VALIDATOR=/path/to/agave-4.3/bin/solana-test-validator ./scripts/e2e-local.sh
set -eo pipefail
cd "$(dirname "$0")/.."

LEDGER=$(mktemp -d)
ADMIN="$LEDGER/admin.json"
solana-keygen new --no-bip39-passphrase -s -o "$ADMIN" >/dev/null

# Token-2022 as devnet runs it: the copy in the validator's genesis predates the
# confidential instruction layout the Kit client sends.
CLONE_URL=${CLONE_URL:-https://rpc.magicblock.app/devnet}
${VALIDATOR:-solana-test-validator} --reset --quiet --ledger "$LEDGER/ledger" \
  --url "$CLONE_URL" --clone-upgradeable-program TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb \
  --bpf-program 6YdZN72p68ynpGH1SwZ86EseFokch6zPAQPAq9NxPY7D target/deploy/agama_solana.so &
VALIDATOR=$!
trap 'kill $VALIDATOR 2>/dev/null; rm -rf "$LEDGER"' EXIT

export SOLANA_RPC=http://127.0.0.1:8899
until solana -u "$SOLANA_RPC" cluster-version >/dev/null 2>&1; do sleep 1; done
solana -u "$SOLANA_RPC" airdrop 100 "$(solana-keygen pubkey "$ADMIN")" >/dev/null

export ANCHOR_WALLET="$ADMIN"
echo "== setup"
./node_modules/.bin/tsx scripts/setup.ts 2>&1 | grep -v "punycode\|trace-deprecation\|bigint"
echo "== user e2e"
./node_modules/.bin/tsx scripts/e2e.ts 2>&1 | grep -v "punycode\|trace-deprecation\|bigint"
echo "== agents e2e"
./node_modules/.bin/tsx scripts/agents-e2e.ts 2>&1 | grep -v "punycode\|trace-deprecation\|bigint"
echo "== private e2e (confidential balances)"
./node_modules/.bin/tsx scripts/private-e2e.ts 2>&1 | grep -v "punycode\|trace-deprecation\|bigint"
