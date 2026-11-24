#!/usr/bin/env bash
#
# simulate-seller-inquiry-queue.sh — drive the whole landing-page enquiry lifecycle against a LOCAL gateway.
#
# An enquiry is a `sellers.sellers` row with `status = 'INQUIRY'` and `source = 'web'` (0129) — there is
# no separate lead table. Two independent dimensions are worked in the portal queue:
#   - `inquiry_stage` (the call-back): NEW → CONTACTED → APPROVED | REJECTED
#   - `status` (the merchant lifecycle): INQUIRY → PENDING_REVIEW | REJECTED
#
# Two halves, both real HTTP:
#   1. PUBLIC  — a visitor submits the enquiry exactly as /sell-with-us does (buildInquiryPayload).
#   2. ADMIN   — a super admin works it in the portal queue: list → claim → stage → gates → decision,
#                plus the 400/404/409 gates and the district scope.
#
# Promoting an enquiry to PENDING_REVIEW does NOT create a second record: the merchant finishes KYC in
# the app and `POST /sellers` promotes that same row (`Repo.matchOpenInquiry`). INQUIRY → ACTIVE is
# refused — an enquiry carries no KYC documents.
#
# Requirements: bash, curl, python3 (JSON parsing), and a running gateway with portal auth enabled
# (PORTAL_JWT_SECRET + PORTAL_PEPPER) plus a SUPER_ADMIN in admins.portal_users. An enquiry requires at
# least one shop picture and claiming promotes that DRAFT asset to ACTIVE, so the two visitors need two
# distinct unclaimed drafts: set SHOP_PHOTO_ID (visitor A) and SHOP_PHOTO_ID_B (visitor B) to real
# `POST /media/avif` assetIds:
#
#   ID=$(curl -s -X POST "$GATEWAY_URL/media/avif" -H 'Content-Type: image/jpeg' \
#          --data-binary @shop.jpg | python3 -c "import json,sys;print(json.load(sys.stdin)['assetId'])")
#
# Usage:
#   PORTAL_EMAIL=... PORTAL_PASSWORD=... SHOP_PHOTO_ID=... \
#     ./scripts/simulate-seller-inquiry-queue.sh [GATEWAY_URL]
#
# Exits non-zero if any assertion fails.

set -uo pipefail

GATEWAY_URL="${1:-${GATEWAY_URL:-http://localhost:8080}}"
: "${PORTAL_EMAIL:?set PORTAL_EMAIL to a SUPER_ADMIN portal login}"
: "${PORTAL_PASSWORD:?set PORTAL_PASSWORD}"
: "${SHOP_PHOTO_ID:?set SHOP_PHOTO_ID to a real POST /media/avif assetId for visitor A}"
: "${SHOP_PHOTO_ID_B:?set SHOP_PHOTO_ID_B to a second unclaimed assetId for visitor B (the draft for A is already claimed)}"

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

echo "Simulating the seller-enquiry lifecycle against ${GATEWAY_URL} (run ${RUN_ID})"
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

# submit_inquiry NAME PHONE EMAIL PHOTO -> prints "<status> <body>"
submit_inquiry() {
  curl -s -m 15 -w '\n%{http_code}' -X POST "${GATEWAY_URL}/seller-inquiries" \
    -H 'Content-Type: application/json' \
    -d "{\"businessName\":\"$1\",\"ownerName\":\"Queue Owner\",\"category\":\"MART\",\"contactPhone\":\"$2\",\"contactEmail\":\"$3\",\"businessAddress\":\"12 Bharathiar Street, Karaikal\",\"districtName\":\"Karaikal\",\"latitude\":10.9254,\"longitude\":79.838,\"platformFeePct\":10,\"notes\":\"sim ${RUN_ID}\",\"shopPhotoIds\":[\"$4\"]}"
}

# ── 1. PUBLIC: two visitors submit landing-page enquiries ────────────────────────────────────────
NAME_A="Queue Sim Mart ${RUN_ID}"
NAME_B="Queue Reject Mart ${RUN_ID}"

CREATE="$(submit_inquiry "$NAME_A" "98765${RUN_ID: -5}" "queue-a-${RUN_ID}@example.com" "$SHOP_PHOTO_ID")"
expect "public enquiry A accepted" 201 "$(printf '%s' "$CREATE" | tail -n1)"
SELLER_A="$(printf '%s' "$CREATE" | sed '$d' | json "d.get('sellerId','')")"
if [ -z "$SELLER_A" ]; then echo "FAIL  no sellerId: ${CREATE}"; exit 1; fi
echo "      sellerId=${SELLER_A}"

CREATE_B="$(submit_inquiry "$NAME_B" "98766${RUN_ID: -5}" "queue-b-${RUN_ID}@example.com" "$SHOP_PHOTO_ID_B")"
expect "public enquiry B accepted" 201 "$(printf '%s' "$CREATE_B" | tail -n1)"
SELLER_B="$(printf '%s' "$CREATE_B" | sed '$d' | json "d.get('sellerId','')")"
if [ -z "$SELLER_B" ]; then echo "FAIL  no sellerId for B: ${CREATE_B}"; exit 1; fi

# ── 2. ADMIN: the enquiry is visible in the queue ────────────────────────────────────────────────
LIST="$(curl -s -m 15 "${GATEWAY_URL}/seller-inquiries?stage=NEW&q=${RUN_ID}" -H "$AUTH")"
FOUND="$(printf '%s' "$LIST" | python3 -c "
import json,sys
rows=json.load(sys.stdin)
print(sum(1 for r in rows if r.get('sellerId')=='${SELLER_A}'))" 2>/dev/null || echo 0)"
expect "enquiry appears in the NEW queue" 1 "$FOUND"

STATUS="$(printf '%s' "$LIST" | python3 -c "
import json,sys
rows=json.load(sys.stdin)
print(next((r['status'] for r in rows if r.get('sellerId')=='${SELLER_A}'),''))" 2>/dev/null || echo "")"
expect "initial lifecycle status" INQUIRY "$STATUS"

# ── 3. ADMIN: claim the call-back ────────────────────────────────────────────────────────────────
CLAIM="$(curl -s -m 15 -X POST "${GATEWAY_URL}/seller-inquiries/${SELLER_A}/assign" -H "$AUTH" \
  -H 'Content-Type: application/json' -d '{"assigned":"me"}')"
ASSIGNED="$(printf '%s' "$CLAIM" | json "d.get('inquiryAssignedTo','')")"
if [ -n "$ASSIGNED" ]; then ok "claim recorded (assignedTo=${ASSIGNED})"; else bad "claim did not record an owner: ${CLAIM}"; fi

# ── 4. ADMIN: move the call-back stage to CONTACTED ──────────────────────────────────────────────
STAGE="$(curl -s -m 15 -w '\n%{http_code}' -X PATCH "${GATEWAY_URL}/seller-inquiries/${SELLER_A}" -H "$AUTH" \
  -H 'Content-Type: application/json' -d '{"stage":"CONTACTED"}')"
expect "move call-back stage to CONTACTED" 200 "$(printf '%s' "$STAGE" | tail -n1)"
expect "stage stored" CONTACTED "$(printf '%s' "$STAGE" | sed '$d' | json "d.get('inquiryStage','')")"

# The decision dimension is separate: an enquiry can be CONTACTED and still INQUIRY.
expect "status unchanged by a stage move" INQUIRY "$(printf '%s' "$STAGE" | sed '$d' | json "d.get('status','')")"

# ── 5. ADMIN: the gates ──────────────────────────────────────────────────────────────────────────
expect "unknown stage is refused" 400 "$(curl -s -m 15 -o /dev/null -w '%{http_code}' -X PATCH "${GATEWAY_URL}/seller-inquiries/${SELLER_A}" -H "$AUTH" -H 'Content-Type: application/json' -d '{"stage":"BOGUS"}')"
expect "INQUIRY -> ACTIVE is refused" 400 "$(curl -s -m 15 -o /dev/null -w '%{http_code}' -X PATCH "${GATEWAY_URL}/seller-inquiries/${SELLER_A}" -H "$AUTH" -H 'Content-Type: application/json' -d '{"status":"ACTIVE"}')"
expect "reject without a reason is refused" 400 "$(curl -s -m 15 -o /dev/null -w '%{http_code}' -X PATCH "${GATEWAY_URL}/seller-inquiries/${SELLER_B}" -H "$AUTH" -H 'Content-Type: application/json' -d '{"status":"REJECTED"}')"
expect "reject with a too-short reason is refused" 400 "$(curl -s -m 15 -o /dev/null -w '%{http_code}' -X PATCH "${GATEWAY_URL}/seller-inquiries/${SELLER_B}" -H "$AUTH" -H 'Content-Type: application/json' -d '{"status":"REJECTED","reason":"no"}')"
expect "queue stage filter rejects garbage" 400 "$(curl -s -m 15 -o /dev/null -w '%{http_code}' "${GATEWAY_URL}/seller-inquiries?stage=BOGUS" -H "$AUTH")"
expect "unknown enquiry id is a 404" 404 "$(curl -s -m 15 -o /dev/null -w '%{http_code}' -X PATCH "${GATEWAY_URL}/seller-inquiries/sel-doesnotexist" -H "$AUTH" -H 'Content-Type: application/json' -d '{"stage":"CONTACTED"}')"

# ── 6. ADMIN: reject enquiry B with a reason ────────────────────────────────────────────────────
REJ="$(curl -s -m 15 -w '\n%{http_code}' -X PATCH "${GATEWAY_URL}/seller-inquiries/${SELLER_B}" -H "$AUTH" \
  -H 'Content-Type: application/json' -d '{"status":"REJECTED","reason":"Shop does not exist at the given address"}')"
expect "reject with a reason" 200 "$(printf '%s' "$REJ" | tail -n1)"
expect "status after reject" REJECTED "$(printf '%s' "$REJ" | sed '$d' | json "d.get('status','')")"

# A decided row is no longer an enquiry: the queue refuses further enquiry moves.
expect "a rejected row refuses further enquiry moves" 409 "$(curl -s -m 15 -o /dev/null -w '%{http_code}' -X PATCH "${GATEWAY_URL}/seller-inquiries/${SELLER_B}" -H "$AUTH" -H 'Content-Type: application/json' -d '{"stage":"CONTACTED"}')"

# ── 7. ADMIN: promote enquiry A — the merchant is proceeding ────────────────────────────────────
ACC="$(curl -s -m 15 -w '\n%{http_code}' -X PATCH "${GATEWAY_URL}/seller-inquiries/${SELLER_A}" -H "$AUTH" \
  -H 'Content-Type: application/json' -d '{"status":"PENDING_REVIEW"}')"
expect "promote to PENDING_REVIEW" 200 "$(printf '%s' "$ACC" | tail -n1)"
ACC_BODY="$(printf '%s' "$ACC" | sed '$d')"
expect "status after promote" PENDING_REVIEW "$(printf '%s' "$ACC_BODY" | json "d.get('status','')")"
expect "the promoted row keeps its seller id" "$SELLER_A" "$(printf '%s' "$ACC_BODY" | json "d.get('sellerId','')")"

# Promotion does not duplicate the merchant: the same id is now a normal seller application.
SAME="$(curl -s -m 15 "${GATEWAY_URL}/seller-inquiries?q=${RUN_ID}" -H "$AUTH" | python3 -c "
import json,sys
rows=json.load(sys.stdin)
print(sum(1 for r in rows if r.get('sellerId')=='${SELLER_A}'))" 2>/dev/null || echo "?")"
expect "promoted enquiry left the enquiry queue" 0 "$SAME"

# ── 8. ADMIN: the district picker actually narrows the queue ────────────────────────────────────
for D in PY1 TTC TCH; do
  LEAK="$(curl -s -m 15 "${GATEWAY_URL}/seller-inquiries?district=${D}" -H "$AUTH" | python3 -c "
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
echo "    \"select seller_id, business_name, status, source, inquiry_stage, inquiry_assigned_to from sellers.sellers where seller_id in ('${SELLER_A}','${SELLER_B}');\""

[ "$fail" -eq 0 ]
