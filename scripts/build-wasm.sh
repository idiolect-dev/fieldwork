#!/usr/bin/env bash
#
# Build the fieldwork-wasm crate and drop the wasm-pack output into
# app/src/wasm/pkg/ so the Vite dev server / build can pick it up.
#
# Run this after any Rust change. Cold build takes a few minutes
# (pulls idiolect-records and its deps); warm rebuilds are seconds.

set -euo pipefail
cd "$(dirname "$0")/.."

# Clean any stale output so `import "./pkg/fieldwork_wasm.js"` always
# picks up freshly-built files.
mkdir -p app/src/wasm/pkg
rm -rf app/src/wasm/pkg/*

wasm-pack build crates/fieldwork-wasm \
  --target web \
  --out-dir ../../app/src/wasm/pkg

echo "✓ fieldwork-wasm built → app/src/wasm/pkg/"
