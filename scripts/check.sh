#!/usr/bin/env bash
# What CI runs, before pushing.
set -euo pipefail
cd "$(dirname "$0")/.."
cargo fmt --check
cargo build-sbf --manifest-path programs/agama-solana/Cargo.toml
./scripts/fetch-fixtures.sh
cargo test
(cd cre/contracts && bun install >/dev/null) && (cd cre/agama-prices && bun install >/dev/null && bunx tsc --noEmit)
pnpm typecheck
if [ -d web ]; then (cd web && pnpm typecheck && pnpm build); fi
echo "all green"
