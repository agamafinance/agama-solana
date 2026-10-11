#!/usr/bin/env bash
# Test fixtures from devnet, not committed: Chainlink's Data Streams Verifier
# program, its config PDA (["verifier"]) and the access controller it names.
# Each account is saved as <address>.bin (data) and <address>.owner. The signed
# reports themselves are committed (tests/fixtures/reports.json).
set -euo pipefail
cd "$(dirname "$0")/.."
RPC="${SOLANA_RPC:-https://api.devnet.solana.com}"
DIR=programs/agama-solana/tests/fixtures
mkdir -p "$DIR"
[ -f "$DIR/verifier.so" ] || solana program dump -u "$RPC" Gt9S41PtjR58CbG9JhJ3J6vxesqrNAswbWYbLNTMZA3c "$DIR/verifier.so" >/dev/null
for a in HJR45sRiFdGncL69HVzRK4HLS2SXcVW3KeTPkp2aFmWC 2k3DsgwBoqrnvXKVvd7jX7aptNxdcRBdcd5HkYsGgbrb; do
  [ -f "$DIR/$a.bin" ] && continue
  solana account -u "$RPC" "$a" --output json-compact | python3 -c "
import base64, json, sys
a = json.load(sys.stdin)['account']
open('$DIR/$a.bin', 'wb').write(base64.b64decode(a['data'][0]))
open('$DIR/$a.owner', 'w').write(a['owner'])"
done
