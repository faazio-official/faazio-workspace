#!/usr/bin/env bash
#
# simulate-seller-registration.sh — drive POST /sellers end-to-end against a LOCAL gateway.
#
# What it does: mints legacy Supabase/GoTrue HS256 bearer tokens (sub + phone + exp) that the
# gateway verifies with SUPABASE_JWT_SECRET, then submits N seller applications exactly as the
# customer app's SellWithUs screen would (otpVerified: true + a phone that matches the token's
# phone claim). Each applicant is unique (sub / phone / email / business name) so the
# contact_email uniqueness constraint is never tripped by the simulation itself.
#
# This is the local stand-in for a real Firebase ID token after phone-OTP verification: it
# exercises the same auth.Require -> ProvisionUserID -> auth.OTPSigned -> CreateExtended path.
#
# Requirements (no other deps): bash, openssl, curl. The gateway must already be running with
# SUPABASE_JWT_SECRET set to the same value exported here.
#
# Usage:
#   export SUPABASE_JWT_SECRET='<same secret the gateway uses>'
#   ./scripts/simulate-seller-registration.sh [N] [GATEWAY_URL]
#
#   N           number of registrations to submit (default 5)
#   GATEWAY_URL base URL of the local gateway (default http://localhost:8080)
#
# Exits non-zero if any registration or the follow-up GET /sellers/me check fails.

set -uo pipefail

N="${1:-${N:-5}}"
GATEWAY_URL="${2:-${GATEWAY_URL:-http://localhost:8080}}"
: "${SUPABASE_JWT_SECRET:?set SUPABASE_JWT_SECRET to the same value the gateway uses}"

command -v curl >/dev/null 2>&1 || { echo "curl is required" >&2; exit 2; }
command -v openssl >/dev/null 2>&1 || { echo "openssl is required" >&2; exit 2; }

RUN_ID="$(date +%s)"
STATE_CODE="TN"
DISTRICT_CODE="TTC"
LAT="10.7905"
LNG="78.7047"

b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }

mkjwt() {
  local sub="$1" phone="$2"
  local exp=$(( $(date +%s) + 315360000 ))
  local header='{"alg":"HS256","typ":"JWT"}'
  local payload="{\"sub\":\"${sub}\",\"phone\":\"${phone}\",\"exp\":${exp}}"
  local h p sig
  h="$(printf '%s' "$header" | b64url)"
  p="$(printf '%s' "$payload" | b64url)"
  sig="$(printf '%s' "${h}.${p}" | openssl dgst -sha256 -hmac "$SUPABASE_JWT_SECRET" -binary | b64url)"
  printf '%s.%s.%s' "$h" "$p" "$sig"
}

json_field() { printf '%s' "$1" | sed -n "s/.*\"$2\":\"\([^\"]*\)\".*/\1/p"; }

pass=0
fail=0

echo "Simulating ${N} seller registration(s) against ${GATEWAY_URL} (run ${RUN_ID})"
echo "-----------------------------------------------------------------------"

for i in $(seq 1 "$N"); do
  national="$(printf '%010d' $(( (RUN_ID % 100000000) * 10 + i )))"
  phone="+91${national}"
  sub="sim-auth-${RUN_ID}-${i}"
  email="sim-${RUN_ID}-${i}@example.com"
  biz="Sim Traders ${RUN_ID}-${i}"
  owner="Sim Owner ${i}"
  token="$(mkjwt "$sub" "$phone")"

  body="$(cat <<JSON
{
  "businessName": "${biz}",
  "ownerName": "${owner}",
  "gstin": "",
  "pan": "ABCDE1234F",
  "businessAddress": "12 Market Road, Tiruchirappalli",
  "contactPhone": "${phone}",
  "contactEmail": "${email}",
  "stateCode": "${STATE_CODE}",
  "districtCode": "${DISTRICT_CODE}",
  "latitude": ${LAT},
  "longitude": ${LNG},
  "vendors": [
    {
      "name": "Sim Vendor ${RUN_ID}-${i}",
      "app": "FOOD",
      "categoryId": "",
      "platformFeePct": 10,
      "fssaiNumber": "12345678901234",
      "fssaiFileKey": "kyc/sim/fssai_${RUN_ID}_${i}.jpg",
      "address": "12 Market Road, Tiruchirappalli",
      "phone": "${phone}",
      "hours": "09:00-21:00",
      "latitude": ${LAT},
      "longitude": ${LNG}
    }
  ],
  "bankName": "HDFC Bank",
  "bankAccountNumber": "123456789012",
  "bankIfsc": "HDFC0001234",
  "bankBeneficiary": "${owner}",
  "passbookFileKey": "kyc/sim/passbook_${RUN_ID}_${i}.jpg",
  "otpVerified": true
}
JSON
)"

  resp="$(curl -s -w '\n%{http_code}' -X POST "${GATEWAY_URL}/sellers" \
    -H "Authorization: Bearer ${token}" \
    -H 'Content-Type: application/json' \
    --data "$body")"
  code="$(printf '%s' "$resp" | tail -n1)"
  payload="$(printf '%s' "$resp" | sed '$d')"
  seller_id="$(json_field "$payload" sellerId)"
  status="$(json_field "$payload" status)"

  if [ "$code" != "201" ]; then
    echo "[$i/${N}] FAIL  POST /sellers -> HTTP ${code}: ${payload}"
    fail=$((fail + 1))
    continue
  fi
  if [ "$status" != "PENDING_REVIEW" ]; then
    echo "[$i/${N}] FAIL  POST /sellers -> 201 but status=${status} (want PENDING_REVIEW)"
    fail=$((fail + 1))
    continue
  fi

  me="$(curl -s -w '\n%{http_code}' "${GATEWAY_URL}/sellers/me" -H "Authorization: Bearer ${token}")"
  me_code="$(printf '%s' "$me" | tail -n1)"
  me_payload="$(printf '%s' "$me" | sed '$d')"
  me_id="$(json_field "$me_payload" sellerId)"

  if [ "$me_code" != "200" ] || [ "$me_id" != "$seller_id" ]; then
    echo "[$i/${N}] FAIL  GET /sellers/me -> HTTP ${me_code}, sellerId=${me_id:-<none>} (want ${seller_id})"
    fail=$((fail + 1))
    continue
  fi

  echo "[$i/${N}] PASS  ${seller_id}  status=${status}  phone=${phone}  (me ok)"
  pass=$((pass + 1))
done

echo "-----------------------------------------------------------------------"
echo "Summary: ${pass} passed, ${fail} failed (of ${N})"
[ "$fail" -eq 0 ]
