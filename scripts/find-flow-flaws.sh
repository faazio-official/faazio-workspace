#!/usr/bin/env bash
# find-flow-flaws.sh — read-only flaw scan for the COD order + delivery fulfilment workflows.
#
# This is NOT a test: it greps the real source for the anti-patterns the workflow tests guard
# against. Run it before/after changing checkout, delivery or reviews. It never edits anything.
#
#   scripts/find-flow-flaws.sh          # report only (exit 0)
#   scripts/find-flow-flaws.sh --strict # exit 1 when a HARD finding is present
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STRICT=0
[ "${1:-}" = "--strict" ] && STRICT=1

SERVER_DIRS=(
  "$ROOT/server/gateway/internal/checkout"
  "$ROOT/server/gateway/internal/delivery"
  "$ROOT/server/gateway/internal/reviews"
)
CLIENT_DIRS=(
  "$ROOT/client/mobile/src/features/cart"
  "$ROOT/client/mobile/src/features/delivery-partner"
  "$ROOT/client/mobile/src/features/profile"
)

hard=0
section() { printf '\n== %s ==\n' "$1"; }

# hits <pattern> <path...> -> non-test matches only (newline-joined), empty when clean.
hits() {
  local pattern="$1"; shift
  grep -rnE "$pattern" "$@" 2>/dev/null | grep -v '_test\.' || true
}

# report <severity> <label> <pattern> <path...>
report() {
  local severity="$1" label="$2" pattern="$3"; shift 3
  local out
  out="$(hits "$pattern" "$@")"
  if [ -n "$out" ]; then
    printf '\n[%s] %s\n%s\n' "$severity" "$label" "$out"
    [ "$severity" = "HARD" ] && hard=1
  else
    printf '[clean] %s\n' "$label"
  fi
}

section "Server: demo/mock/stub values in non-test code (HARD)"
report HARD "hardcoded demo data" 'hardcod|dummy|\bmock\b|\bfake\b' "${SERVER_DIRS[@]}"

section "Server: unparameterised SQL built by string formatting (HARD)"
report HARD "fmt built into SQL" 'Query(Row)?\([^)]*Sprintf|Exec\([^)]*Sprintf' "${SERVER_DIRS[@]}"

section "Client: console logging in workflow code (HARD)"
report HARD "console.log/error/debug" 'console\.(log|error|debug)\(' "${CLIENT_DIRS[@]}"

section "Client: numeric sentinels that look like demo data (INFO — verify each)"
report INFO "9999/0000/1234 literals" '\b(9999|0000|1234)\b' "${SERVER_DIRS[@]}"

section "Client: swallowed errors on workflow calls (INFO — review each)"
report INFO "empty catch" '\.catch\(\(\)\s*=>\s*\{\}\)|catch\s*\{\s*\}' "${CLIENT_DIRS[@]}"

section "Client: @data/* used in workflow code (INFO — types/constants allowed, live fixtures not)"
report INFO "@data imports" "from '@data/" "${CLIENT_DIRS[@]}"

section "Idempotency / retry call sites (INFO — confirm server guards)"
report INFO "placeOrder / payForOrder" 'placeOrder\(|payForOrder\(' "${CLIENT_DIRS[@]}"

printf '\n== summary ==\n'
if [ "$hard" -ne 0 ]; then
  echo "HARD findings present (see above)."
else
  echo "No HARD findings."
fi
if [ "$STRICT" -eq 1 ] && [ "$hard" -ne 0 ]; then
  exit 1
fi
exit 0