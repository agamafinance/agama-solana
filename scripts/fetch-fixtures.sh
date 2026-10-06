#!/usr/bin/env bash
# Test fixture: Chainlink's CRE mock forwarder, as deployed on devnet (the one
# `cre workflow simulate` relays through). Not committed: fetched from chain.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=programs/agama-solana/tests/fixtures/mock_forwarder.so
[ -f "$OUT" ] && exit 0
mkdir -p "$(dirname "$OUT")"
solana program dump -u "${SOLANA_RPC:-https://api.devnet.solana.com}" 7kuEAA3mSC1Tz8gQjnvH7bKFda9xSPRRin9SZbH49cNK "$OUT"
