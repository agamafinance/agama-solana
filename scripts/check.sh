#!/usr/bin/env bash
# What CI runs, before pushing.
set -euo pipefail
cd "$(dirname "$0")/.."
cargo fmt --check
cargo build-sbf --manifest-path programs/agama-solana/Cargo.toml
cargo test
pnpm typecheck
if [ -d web ]; then (cd web && pnpm typecheck && pnpm build); fi
echo "all green"
