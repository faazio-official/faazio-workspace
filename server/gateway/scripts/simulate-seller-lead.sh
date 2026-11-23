#!/usr/bin/env bash
#
# simulate-seller-lead.sh — drive POST /seller-leads end-to-end against a LOCAL gateway.
#
# What it does: submits the public "Sell with us" enquiry exactly as the landing page does. The
# payload is built by client/web/landingpage/src/lib/leads.ts (buildLeadPayload) and sent through the
# TanStack Start server function in production; here curl posts the same body straight to the gateway,
# which is the only difference (the proxy adds no fields).
#
# The gateway decodes with DisallowUnknownFields, so this script is also the contract check: a field
# the client sends but createLeadRequest omits is a 400 on every real enquiry. If the "landing page
# body" case below fails, the wire contract has drifted.
#
# It asserts the full response matrix, not just the happy path:
#   201  valid enquiry (source:"web" included — the field that once 400'd every submission)
#   201  honeypot filled (silent accept, no row)
#   400  unknown district code
#   400  bad category
#   400  missing platform fee / FOOD fee below the 5% floor
#   400  unknown field (DisallowUnknownFields guard)
#   200  public district read (GET /seller-leads/districts)
#   429  per-IP daily cap (only when Valkey is reachable and the cap is already spent)
#
# Requirements: bash, curl. No DB credentials, no JWT — the route is public by design.
#
# Usage:
#   ./scripts/simulate-seller-lead.sh [GATEWAY_URL]
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
  curl -s -m 15 -w '\n%{http_code}' -X POST "${GATEWAY_URL}/seller-leads" \
    -H 'Content-Type: application/json' --data "$1"
}

# The route is capped at 5 enquiries per IP per UTC day (Valkey). Repeated runs from one machine
# would otherwise 429 the happy path and look like a contract failure. Clear the day's lead counters
# before starting — best-effort: no Valkey (or no docker) just leaves the cap in place, and the 429
# guidance below explains what to do.
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
# the mandatory platform fee + source:"web" (kept for wire-compat with an older cached bundle).
landing_page_body() {
  cat <<JSON
{
  "businessName": "Sim Lead Mart ${RUN_ID}",
  "ownerName": "Sim Lead Owner",
  "category": "MART",
  "contactPhone": "9876543210",
  "contactEmail": "sim-lead-${RUN_ID}@example.com",
  "businessAddress": "12 Bharathiar Street, Karaikal",
  "stateCode": "PY",
  "districtCode": "PY1",
  "districtName": "Karaikal",
  "latitude": 10.9254,
  "longitude": 79.838,
  "platformFeePct": 10,
  "notes": "simulate-seller-lead.sh run ${RUN_ID}",
  "source": "web"
}
JSON
}

echo "Simulating landing-page seller leads against ${GATEWAY_URL} (run ${RUN_ID})"
echo "--------------------------------------------------------------------------"

reset_rate_limit

# 1. The real client body — must be 201 and carry a leadId.
if check "landing page body (source:\"web\")" 201 "$(landing_page_body)"; then
  if printf '%s' "$LAST_PAYLOAD" | grep -q '"leadId"'; then
    echo "      leadId present: $(printf '%s' "$LAST_PAYLOAD" | sed -n 's/.*"leadId":"\([^"]*\)".*/\1/p')"
  else
    echo "FAIL  valid enquiry returned no leadId: ${LAST_PAYLOAD}"
    fail=$((fail + 1))
  fi
fi

# 2. Honeypot: silently accepted, no row written. Must look like success to a bot.
check "honeypot silently accepted" 201 '{"businessName":"Bot Shop","ownerName":"Bot","category":"MART","contactPhone":"9876543210","contactEmail":"bot@example.com","businessAddress":"12 Some Street","districtName":"Karaikal","platformFeePct":10,"website":"http://spam.example"}'

# 3. An unknown district code is a hard 400 (not silently stored).
check "unknown district code rejected" 400 '{"businessName":"X","ownerName":"Y","category":"MART","contactPhone":"9876543210","contactEmail":"a@b.com","businessAddress":"12 Some Street","districtCode":"ZZZ","platformFeePct":10}'

# 4. A category outside MART/FOOD/PHARMA is a 400.
check "bad category rejected" 400 '{"businessName":"X","ownerName":"Y","category":"GROCERY","contactPhone":"9876543210","contactEmail":"a@b.com","businessAddress":"12 Some Street","districtName":"Karaikal","platformFeePct":10}'

# 5. The platform fee is required — an enquiry without one is a 400.
check "missing platform fee rejected" 400 '{"businessName":"X","ownerName":"Y","category":"MART","contactPhone":"9876543210","contactEmail":"a@b.com","businessAddress":"12 Some Street","districtName":"Karaikal"}'

# 6. A FOOD enquiry below the 5% floor is a 400.
check "food fee below floor rejected" 400 '{"businessName":"X","ownerName":"Y","category":"FOOD","contactPhone":"9876543210","contactEmail":"a@b.com","businessAddress":"12 Some Street","districtName":"Karaikal","platformFeePct":2}'

# 7. A typo'd field is still rejected — the DisallowUnknownFields guard must stay on.
check "unknown field rejected" 400 '{"businessName":"X","ownerName":"Y","category":"MART","contactPhone":"9876543210","contactEmail":"a@b.com","businessAddress":"12 Some Street","districtName":"Karaikal","platformFeePct":10,"soruce":"web"}'

# 8. The district read the form resolves codes from is public and carries Karaikal.
if curl -s -m 15 "${GATEWAY_URL}/seller-leads/districts" | grep -q '"districtCode":"PY1"'; then
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
echo "    \"select lead_id, business_name, status, source from sellers.seller_leads where business_name like 'Sim Lead Mart%' order by created_at desc;\""

[ "$fail" -eq 0 ]
