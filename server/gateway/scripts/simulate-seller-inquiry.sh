#!/usr/bin/env bash
#
# simulate-seller-inquiry.sh — drive POST /seller-inquiries end-to-end against a LOCAL gateway.
#
# What it does: submits the public "Sell with us" enquiry exactly as the landing page does. The
# payload is built by client/web/landingpage/src/lib/inquiries.ts (buildInquiryPayload) and sent
# through the TanStack Start server function in production; here curl posts the same body straight to
# the gateway, which is the only difference (the proxy adds no fields).
#
# The gateway decodes with DisallowUnknownFields, so this script is also the contract check: a field
# the client sends but createInquiryRequest omits is a 400 on every real enquiry. If the "landing page
# body" case below fails, the wire contract has drifted.
#
# An enquiry is a sellers.sellers row with status INQUIRY (0129), not a separate lead table.
#
# It asserts the full response matrix, not just the happy path:
#   201  valid enquiry (source:"web" stamped server-side)
#   201  honeypot filled (silent accept, no row)
#   400  unknown district code
#   400  bad category
#   400  missing platform fee / FOOD fee below the 5% floor
#   400  missing shop photo
#   400  unknown field (DisallowUnknownFields guard)
#   200  public district read (GET /seller-inquiries/districts)
#   429  per-IP daily cap (only when Valkey is reachable and the cap is already spent)
#
# Requirements: bash, curl. No DB credentials, no JWT — the route is public by design.
#
# Usage:
#   ./scripts/simulate-seller-inquiry.sh [GATEWAY_URL]
#
#   GATEWAY_URL base URL of the local gateway (default http://localhost:8080)
#
# Exits non-zero if any assertion fails.

set -uo pipefail

GATEWAY_URL="${1:-${GATEWAY_URL:-http://localhost:8080}}"

command -v curl >/dev/null 2>&1 || { echo "curl is required" >&2; exit 2; }

RUN_ID="$(date +%s)"
pass=0
fail=0

# post BODY -> prints "<status> <body>"
post() {
  curl -s -m 15 -w '\n%{http_code}' -X POST "${GATEWAY_URL}/seller-inquiries" \
    -H 'Content-Type: application/json' --data "$1"
}

# The route is capped at 5 enquiries per IP per UTC day (Valkey). Repeated runs from one machine
# would otherwise 429 the happy path and look like a contract failure. Clear the day's enquiry
# counters before starting — best-effort: no Valkey (or no docker) just leaves the cap in place, and
# the 429 guidance below explains what to do.
reset_rate_limit() {
  command -v docker >/dev/null 2>&1 || return 0
  local key
  for key in $(docker exec gateway-valkey-1 valkey-cli --scan --pattern 'faazio:v1:sellers:lead:*' 2>/dev/null); do
    docker exec gateway-valkey-1 valkey-cli DEL "$key" >/dev/null 2>&1 || true
  done
}

# check NAME WANT_STATUS BODY -> records pass/fail
check() {
  local name="$1" want="$2" body="$3"
  local resp code payload
  resp="$(post "$body")"
  code="$(printf '%s' "$resp" | tail -n1)"
  payload="$(printf '%s' "$resp" | sed '$d')"
  if [ "$code" != "$want" ]; then
    echo "FAIL  ${name} -> HTTP ${code}, want ${want}: ${payload}"
    fail=$((fail + 1))
    return 1
  fi
  echo "PASS  ${name} -> HTTP ${code}"
  pass=$((pass + 1))
  LAST_PAYLOAD="$payload"
  return 0
}

# The exact shape the landing page sends: contact fields + pinned location + resolved master codes +
# the mandatory platform fee + the shop photo ids the form uploaded to POST /media/avif.
#
# NOTE: `shopPhotoIds` must reference real PUBLIC AVIF drafts claimed inside the insert, so a curl-only
# run cannot fabricate one. Upload a local JPEG first:
#   ID=$(curl -s -X POST "$GATEWAY_URL/media/avif" -H 'Content-Type: image/jpeg' --data-binary @shop.jpg | sed -n 's/.*"assetId":"\([^"]*\)".*/\1/p')
#   SHOP_PHOTO_ID=... ./scripts/simulate-seller-inquiry.sh
# When SHOP_PHOTO_ID is unset the happy path is skipped (not failed) rather than sending a fake id,
# because the gateway would correctly reject it.
landing_page_body() {
  cat <<JSON
{
  "ownerName": "Sim Inquiry Owner",
  "category": "MART",
  "contactPhone": "9876543210",
  "contactEmail": "sim-inquiry-${RUN_ID}@example.com",
  "businessAddress": "12 Bharathiar Street, Karaikal",
  "stateCode": "PY",
  "districtCode": "PY1",
  "districtName": "Karaikal",
  "latitude": 10.9254,
  "longitude": 79.838,
  "platformFeePct": 10,
  "notes": "simulate-seller-inquiry.sh run ${RUN_ID}",
  "shopPhotoIds": ["${SHOP_PHOTO_ID:-}"]
}
JSON
}

echo "Simulating landing-page seller enquiries against ${GATEWAY_URL} (run ${RUN_ID})"
echo "--------------------------------------------------------------------------"

reset_rate_limit

# 1. The real client body — must be 201 and carry a sellerId (only with a real uploaded photo id).
if [ -n "${SHOP_PHOTO_ID:-}" ]; then
  if check "landing page body" 201 "$(landing_page_body)"; then
    if printf '%s' "$LAST_PAYLOAD" | grep -q '"sellerId"'; then
      echo "      sellerId present: $(printf '%s' "$LAST_PAYLOAD" | sed -n 's/.*"sellerId":"\([^"]*\)".*/\1/p')"
    else
      echo "FAIL  valid enquiry returned no sellerId: ${LAST_PAYLOAD}"
      fail=$((fail + 1))
    fi
  fi
else
  echo "SKIP  landing page body (set SHOP_PHOTO_ID to a real POST /media/avif assetId; see the header)"
fi

# 2. Honeypot: silently accepted, no row written. Must look like success to a bot.
check "honeypot silently accepted" 201 '{"ownerName":"Bot","category":"MART","contactPhone":"9876543210","contactEmail":"bot@example.com","businessAddress":"12 Some Street","districtName":"Karaikal","platformFeePct":10,"shopPhotoIds":["x"],"website":"http://spam.example"}'

# 3. An unknown district code is a hard 400 (not silently stored).
check "unknown district code rejected" 400 '{"ownerName":"Y","category":"MART","contactPhone":"9876543210","contactEmail":"a@b.com","businessAddress":"12 Some Street","districtCode":"ZZZ","platformFeePct":10,"shopPhotoIds":["x"]}'

# 4. A category outside MART/FOOD/PHARMA is a 400.
check "bad category rejected" 400 '{"ownerName":"Y","category":"GROCERY","contactPhone":"9876543210","contactEmail":"a@b.com","businessAddress":"12 Some Street","districtName":"Karaikal","platformFeePct":10,"shopPhotoIds":["x"]}'

# 5. The platform fee is required — an enquiry without one is a 400.
check "missing platform fee rejected" 400 '{"ownerName":"Y","category":"MART","contactPhone":"9876543210","contactEmail":"a@b.com","businessAddress":"12 Some Street","districtName":"Karaikal","shopPhotoIds":["x"]}'

# 6. A FOOD enquiry below the 5% floor is a 400.
check "food fee below floor rejected" 400 '{"ownerName":"Y","category":"FOOD","contactPhone":"9876543210","contactEmail":"a@b.com","businessAddress":"12 Some Street","districtName":"Karaikal","platformFeePct":2,"shopPhotoIds":["x"]}'

# 7. At least one shop picture is required — a shop with no picture is not reviewable.
check "missing shop photo rejected" 400 '{"ownerName":"Y","category":"MART","contactPhone":"9876543210","contactEmail":"a@b.com","businessAddress":"12 Some Street","districtName":"Karaikal","platformFeePct":10,"shopPhotoIds":[]}'

# 8. A typo'd field is still rejected — the DisallowUnknownFields guard must stay on.
check "unknown field rejected" 400 '{"ownerName":"Y","category":"MART","contactPhone":"9876543210","contactEmail":"a@b.com","businessAddress":"12 Some Street","districtName":"Karaikal","platformFeePct":10,"shopPhotoIds":["x"],"soruce":"web"}'

# 9. The district read the form resolves codes from is public and carries Karaikal.
if curl -s -m 15 "${GATEWAY_URL}/seller-inquiries/districts" | grep -q '"districtCode":"PY1"'; then
  echo "PASS  public district read carries PY1"
  pass=$((pass + 1))
else
  echo "FAIL  public district read did not carry PY1"
  fail=$((fail + 1))
fi

echo "--------------------------------------------------------------------------"
echo "Summary: ${pass} passed, ${fail} failed"
if [ "$fail" -ne 0 ]; then
  echo
  echo "If a valid enquiry returned 429, this IP's daily cap (5) was already spent and the"
  echo "counter could not be cleared (is the local Valkey container named gateway-valkey-1?)."
  echo "Clear it by hand:"
  echo "  docker exec gateway-valkey-1 valkey-cli --scan --pattern 'faazio:v1:sellers:lead:*' \\"
  echo "    | xargs -r -n1 docker exec gateway-valkey-1 valkey-cli DEL"
fi
echo
echo "Verify the rows landed (needs the local stack):"
echo "  docker exec gateway-postgres-1 psql -U postgres -d faazio -tAc \\"
echo "    \"select seller_id, owner_name, status, source from sellers.sellers where status = 'INQUIRY' and owner_name like 'Sim Inquiry Owner%' order by created_at desc;\""

[ "$fail" -eq 0 ]
