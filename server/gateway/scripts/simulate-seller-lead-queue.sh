#!/usr/bin/env bash
#
# simulate-seller-lead-queue.sh — drive the whole landing-page lead lifecycle against a LOCAL gateway.
#
# Two halves, both real HTTP:
#   1. PUBLIC  — a visitor submits the enquiry exactly as /sell-with-us does (buildLeadPayload).
#   2. ADMIN   — a super admin works it in the portal queue: list → claim → note/edit → reject →
#                re-open → approve, plus the 400/404/409 gates and the district scope.
#
# This is the end-to-end proof that a lead collected on faazio.com is visible to the super admin and
# movable through NEW → CONTACTED → (APPROVED | REJECTED). Approving does NOT create a seller account:
# the merchant still applies in the mobile app (`POST /sellers`).
#
# Requirements: bash, curl, python3 (JSON parsing), and a running gateway with portal auth enabled
# (PORTAL_JWT_SECRET + PORTAL_PEPPER) plus a SUPER_ADMIN in admins.portal_users.
#
# Usage:
#   PORTAL_EMAIL=... PORTAL_PASSWORD=... ./scripts/simulate-seller-lead-queue.sh [GATEWAY_URL]
#
#   GATEWAY_URL     base URL of the local gateway (default http://localhost:8080)
#   PORTAL_EMAIL    a SUPER_ADMIN portal login
#   PORTAL_PASSWORD its password
#
# Exits non-zero if any assertion fails.

set -uo pipefail

GATEWAY_URL="${1:-${GATEWAY_URL:-http://localhost:8080}}"
: "${PORTAL_EMAIL:?set PORTAL_EMAIL to a SUPER_ADMIN portal login}"
: "${PORTAL_PASSWORD:?set PORTAL_PASSWORD}"

command -v curl >/dev/null 2>&1 || { echo "curl is required" >&2; exit 2; }
command -v python3 >/dev/null 2>&1 || { echo "python3 is required" >&2; exit 2; }

RUN_ID="$(date +%s)"
pass=0
fail=0

ok()   { pass=$((pass + 1)); echo "PASS  $1"; }
bad()  { fail=$((fail + 1)); echo "FAIL  $1"; }

# expect NAME WANT_GOT — compares and records.
expect() {
  local name="$1" want="$2" got="$3"
  if [ "$got" = "$want" ]; then ok "${name} (${got})"; else bad "${name} -> got ${got}, want ${want}"; fi
}

json() { python3 -c "import json,sys;d=json.load(sys.stdin);print($1)" 2>/dev/null || echo ""; }

echo "Simulating the seller-lead lifecycle against ${GATEWAY_URL} (run ${RUN_ID})"
echo "=========================================================================="

# ── 0. Sign in as the super admin ────────────────────────────────────────────────────────────────
LOGIN="$(curl -s -m 15 -X POST "${GATEWAY_URL}/auth/portal/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${PORTAL_EMAIL}\",\"password\":\"${PORTAL_PASSWORD}\"}")"
TOKEN="$(printf '%s' "$LOGIN" | json "d.get('accessToken','')")"
if [ -z "$TOKEN" ]; then
  echo "FAIL  portal login: ${LOGIN}"
  echo "      Is PORTAL_JWT_SECRET set on the gateway and the account a SUPER_ADMIN?"
  exit 1
fi
AUTH="Authorization: Bearer ${TOKEN}"
ok "portal login as super admin"

# ── 1. PUBLIC: the visitor submits the landing-page enquiry ──────────────────────────────────────
NAME="Queue Sim Mart ${RUN_ID}"
PHONE="98765${RUN_ID: -5}"
EMAIL="queue-${RUN_ID}@example.com"
CREATE="$(curl -s -m 15 -w '\n%{http_code}' -X POST "${GATEWAY_URL}/seller-leads" \
  -H 'Content-Type: application/json' \
  -d "{\"businessName\":\"${NAME}\",\"ownerName\":\"Queue Owner\",\"category\":\"MART\",\"contactPhone\":\"${PHONE}\",\"contactEmail\":\"${EMAIL}\",\"businessAddress\":\"12 Bharathiar Street, Karaikal\",\"districtName\":\"Karaikal\",\"latitude\":10.9254,\"longitude\":79.838,\"notes\":\"sim ${RUN_ID}\",\"source\":\"web\"}")"
CREATE_CODE="$(printf '%s' "$CREATE" | tail -n1)"
CREATE_BODY="$(printf '%s' "$CREATE" | sed '$d')"
expect "public enquiry accepted" 201 "$CREATE_CODE"
LEAD_ID="$(printf '%s' "$CREATE_BODY" | json "d.get('leadId','')")"
if [ -z "$LEAD_ID" ]; then echo "FAIL  no leadId: ${CREATE_BODY}"; exit 1; fi
echo "      leadId=${LEAD_ID}"

# ── 2. ADMIN: the lead is visible in the queue ───────────────────────────────────────────────────
LIST="$(curl -s -m 15 "${GATEWAY_URL}/seller-leads?status=NEW&q=${RUN_ID}" -H "$AUTH")"
FOUND="$(printf '%s' "$LIST" | python3 -c "
import json,sys
rows=json.load(sys.stdin)
print(sum(1 for r in rows if r['leadId']=='${LEAD_ID}'))" 2>/dev/null || echo 0)"
expect "lead appears in the NEW queue" 1 "$FOUND"

STATUS="$(printf '%s' "$LIST" | python3 -c "
import json,sys
rows=json.load(sys.stdin)
print(next((r['status'] for r in rows if r['leadId']=='${LEAD_ID}'),''))" 2>/dev/null || echo "")"
expect "initial status" NEW "$STATUS"

# ── 3. ADMIN: claim the call-back ────────────────────────────────────────────────────────────────
CLAIM="$(curl -s -m 15 -X POST "${GATEWAY_URL}/seller-leads/${LEAD_ID}/assign" -H "$AUTH" \
  -H 'Content-Type: application/json' -d '{"assigned":"me"}')"
ASSIGNED="$(printf '%s' "$CLAIM" | json "d.get('assignedTo','')")"
if [ -n "$ASSIGNED" ]; then ok "claim recorded (assignedTo=${ASSIGNED})"; else bad "claim did not record an owner: ${CLAIM}"; fi

# ── 4. ADMIN: edit — move to CONTACTED with a follow-up note ─────────────────────────────────────
EDIT="$(curl -s -m 15 -w '\n%{http_code}' -X PATCH "${GATEWAY_URL}/seller-leads/${LEAD_ID}" -H "$AUTH" \
  -H 'Content-Type: application/json' -d '{"status":"CONTACTED","note":"Called; sending the KYC link"}')"
EDIT_CODE="$(printf '%s' "$EDIT" | tail -n1)"
EDIT_BODY="$(printf '%s' "$EDIT" | sed '$d')"
expect "move to CONTACTED" 200 "$EDIT_CODE"
expect "note stored" "Called; sending the KYC link" "$(printf '%s' "$EDIT_BODY" | json "d.get('adminNote','')")"
REVIEWED="$(printf '%s' "$EDIT_BODY" | json "d.get('reviewedBy','')")"
if [ -n "$REVIEWED" ]; then ok "reviewer recorded (${REVIEWED})"; else bad "reviewedBy is empty"; fi

# ── 5. ADMIN: reject gates ───────────────────────────────────────────────────────────────────────
R1="$(curl -s -m 15 -o /dev/null -w '%{http_code}' -X PATCH "${GATEWAY_URL}/seller-leads/${LEAD_ID}" -H "$AUTH" \
  -H 'Content-Type: application/json' -d '{"status":"REJECTED"}')"
expect "reject without a reason is refused" 400 "$R1"

R2="$(curl -s -m 15 -o /dev/null -w '%{http_code}' -X PATCH "${GATEWAY_URL}/seller-leads/${LEAD_ID}" -H "$AUTH" \
  -H 'Content-Type: application/json' -d '{"status":"REJECTED","note":"no"}')"
expect "reject with a too-short reason is refused" 400 "$R2"

REJ="$(curl -s -m 15 -w '\n%{http_code}' -X PATCH "${GATEWAY_URL}/seller-leads/${LEAD_ID}" -H "$AUTH" \
  -H 'Content-Type: application/json' -d '{"status":"REJECTED","note":"Shop does not exist at the given address"}')"
expect "reject with a reason" 200 "$(printf '%s' "$REJ" | tail -n1)"
expect "status after reject" REJECTED "$(printf '%s' "$REJ" | sed '$d' | json "d.get('status','')")"

# ── 6. ADMIN: re-open and finally ACCEPT ────────────────────────────────────────────────────────
REOPEN="$(curl -s -m 15 -o /dev/null -w '%{http_code}' -X PATCH "${GATEWAY_URL}/seller-leads/${LEAD_ID}" -H "$AUTH" \
  -H 'Content-Type: application/json' -d '{"status":"CONTACTED","note":"Owner called back; re-opening"}')"
expect "re-open a rejected lead" 200 "$REOPEN"

ACC="$(curl -s -m 15 -w '\n%{http_code}' -X PATCH "${GATEWAY_URL}/seller-leads/${LEAD_ID}" -H "$AUTH" \
  -H 'Content-Type: application/json' -d '{"status":"APPROVED","note":"Proceeding; applying in the app"}')"
expect "final approve" 200 "$(printf '%s' "$ACC" | tail -n1)"
ACC_BODY="$(printf '%s' "$ACC" | sed '$d')"
expect "final status" APPROVED "$(printf '%s' "$ACC_BODY" | json "d.get('status','')")"
SELLER_ID="$(printf '%s' "$ACC_BODY" | json "d.get('sellerId','')")"
if [ -z "$SELLER_ID" ]; then
  ok "approving created no seller account (as designed)"
else
  bad "approving created seller ${SELLER_ID} — it must not"
fi

# ── 7. ADMIN: invalid input and unknown ids ─────────────────────────────────────────────────────
expect "unknown status is refused" 400 "$(curl -s -m 15 -o /dev/null -w '%{http_code}' -X PATCH "${GATEWAY_URL}/seller-leads/${LEAD_ID}" -H "$AUTH" -H 'Content-Type: application/json' -d '{"status":"BOGUS"}')"
expect "unknown lead id is a 404" 404 "$(curl -s -m 15 -o /dev/null -w '%{http_code}' -X PATCH "${GATEWAY_URL}/seller-leads/lead-doesnotexist" -H "$AUTH" -H 'Content-Type: application/json' -d '{"status":"CONTACTED"}')"
expect "queue status filter rejects garbage" 400 "$(curl -s -m 15 -o /dev/null -w '%{http_code}' "${GATEWAY_URL}/seller-leads?status=BOGUS" -H "$AUTH")"

# ── 8. ADMIN: the district picker actually narrows the queue ────────────────────────────────────
for D in PY1 TTC TCH; do
  LEAK="$(curl -s -m 15 "${GATEWAY_URL}/seller-leads?district=${D}" -H "$AUTH" | python3 -c "
import json,sys
rows=json.load(sys.stdin)
print(sum(1 for r in rows if r.get('districtCode') and r['districtCode']!='${D}'))" 2>/dev/null || echo "?")"
  expect "?district=${D} returns only ${D}" 0 "$LEAK"
done

echo "=========================================================================="
echo "Summary: ${pass} passed, ${fail} failed"
echo
echo "Verify in the DB:"
echo "  docker exec gateway-postgres-1 psql -U postgres -d faazio -tAc \\"
echo "    \"select lead_id, business_name, status, admin_note, reviewed_by, assigned_to from sellers.seller_leads where lead_id='${LEAD_ID}';\""

[ "$fail" -eq 0 ]
