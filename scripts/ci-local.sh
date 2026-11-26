#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

log() { printf '\n[%s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }
fail() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }
has() { command -v "$1" >/dev/null 2>&1; }

log "MycoGold Africa local CI"
has node || fail "Node.js is required (see .nvmrc / package.json engines)."
has npm || fail "npm is required."
has cmake || fail "CMake is required for the native C++ engine."
has c++ || has g++ || has clang++ || fail "A C++17 compiler is required."

node --version
npm --version
cmake --version | head -n 1

if [[ "${CI_LOCAL_INSTALL:-0}" == "1" ]]; then
  log "Installing exactly from package-lock.json"
  npm ci
fi

[[ -d node_modules ]] || fail "node_modules is missing. Run npm ci, then retry."

run() {
  log "$*"
  "$@"
}

# Do not silently claim a lint pass when the repository has no lint script.
if node -e 'process.exit(require("./package.json").scripts?.lint ? 0 : 1)'; then
  run npm run lint
else
  log "No lint script is defined; skipping lint (not reported as passed)."
fi

run npm run engine:test
run npm run typecheck
run npm test
run npm run check:safety
run npm run build

if [[ "${CI_LOCAL_AUDIT:-1}" == "1" ]]; then
  log "Dependency audit (requires registry access; set CI_LOCAL_AUDIT=0 for offline runs)"
  npm audit --omit=dev --audit-level=high
else
  log "Dependency audit explicitly skipped for offline execution."
fi

if [[ "${CI_LOCAL_DOCKER:-0}" == "1" ]]; then
  has docker || fail "CI_LOCAL_DOCKER=1 but Docker is unavailable."
  run docker compose build
fi

log "LOCAL CI PASSED"
