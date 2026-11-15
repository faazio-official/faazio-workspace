#!/usr/bin/env bash
#
# create-delivery-test-account.sh — create/refresh the login-ready ACTIVE delivery test rider.
#
# Why: the delivery app routes on `GET /delivery/me` (RiderByPhone): ACTIVE -> Dashboard, any other
# status -> "under review", 404 -> Register. The Firebase test number +91 9876543210 has no
# `delivery.delivery_boys` row by default, so sign-in would land on Register. This applies the
# idempotent seed that creates the row (status ACTIVE) and then fails non-zero unless the row is
# present and ACTIVE — so CI, reviewers and fresh dev databases get the same server-driven account
# with no fixture, no mock latency and no client-side bypass.
#
# Credentials come from the git-ignored server/gateway/.env (DATABASE_URL). The SQL is applied by the
# Go migrator `server/gateway/cmd/migrate` (pgx, no psql, no Docker) through
# server/supabase/apply-migration.sh. Not a runtime origin — bootstrap test data only.
#
# Usage:
#   server/gateway/scripts/create-delivery-test-account.sh
#
# Exits non-zero if the seed cannot be applied or the rider is not ACTIVE afterwards.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
SEED="$ROOT/server/supabase/seed/test_delivery_rider.sql"
APPLY="$ROOT/server/supabase/apply-migration.sh"
ENV_FILE="$ROOT/server/gateway/.env"

RIDER_ID="rider-test-faazio-01"
PHONE="+919876543210"

[[ -f "$SEED" ]] || { echo "error: seed not found: $SEED" >&2; exit 1; }
[[ -f "$APPLY" ]] || { echo "error: migrator wrapper not found: $APPLY" >&2; exit 1; }
if [[ ! -f "$ENV_FILE" ]]; then
  echo "error: $ENV_FILE not found (needed for DATABASE_URL)" >&2
  exit 1
fi

# Read-back guard: raise an exception (-> migrator exits non-zero) unless the row is ACTIVE. The
# migrator's statement splitter handles the dollar-quoted DO block.
VERIFY="$(mktemp)"
trap 'rm -f "$VERIFY"' EXIT
cat > "$VERIFY" <<SQL
do \$\$
begin
  if not exists (
    select 1 from delivery.delivery_boys where phone = '${PHONE}' and status = 'ACTIVE'
  ) then
    raise exception 'delivery test rider ${PHONE} is not ACTIVE after seed';
  end if;
end \$\$;
SQL

echo "→ creating delivery test account (${PHONE})"
"$APPLY" "$SEED" "$VERIFY"

echo "✓ delivery test account ready: rider_id=${RIDER_ID} phone=${PHONE} status=ACTIVE"
