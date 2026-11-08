#!/usr/bin/env bash
#
# test-seller-product-create.sh — end-to-end smoke test of the seller "create product + submit for
# review" workflow against a RUNNING gateway (local or staging).
#
# It simulates exactly what the partner portal does, over the real HTTP contract:
#   1. seller login (legacy HS256 token verified with SUPABASE_JWT_SECRET)
#   2. GET  /seller/stores                -> pick a live store the seller owns
#   3. POST /media/upload-url             -> mint a DRAFT asset + presigned PUT
#   4. (R2 PUT simulated — no R2 creds in CI; confirm only touches media.assets)
#   5. POST /media/confirm                -> DRAFT -> ACTIVE, owner linked
#   6. POST /seller/products              -> 201 PENDING_REVIEW (+ stock row, one tx)
#   7. GET  /seller/products              -> the listing is visible as PENDING_REVIEW
#   8. PUT  /seller/inventory/{id}        -> qty + ETA persist
#   9. PUT  /seller/products/{id}/status  -> SUPER_ADMIN approves -> ACTIVE
#  10. negative: missing fields -> 400; foreign store -> 404
#
# Requirements (no other deps): bash, openssl, curl. The gateway must be running with
# SUPABASE_JWT_SECRET set to the same value exported here.
#
# Usage:
#   export SUPABASE_JWT_SECRET='<same secret the gateway uses>'
#   export SELLER_ID='sel-tiruchi-01'          # an ACTIVE seller with a live store
#   ./scripts/test-seller-product-create.sh [GATEWAY_URL]
#
#   GATEWAY_URL  base URL of the gateway (default http://localhost:8080)
#
# Finding a SELLER_ID from the local compose DB:
#   docker exec faazio-local-pg psql \
#     "postgres://postgres:faazio@localhost:5432/faazio?sslmode=disable" -tAc \
#     "select seller_id from sellers.sellers where status='ACTIVE' limit 1"
#
# Exits non-zero if any step fails and prints a PASS/FAIL summary per step.

set -uo pipefail

GATEWAY_URL="${1:-${GATEWAY_URL:-http://localhost:8080}}"
: "${SUPABASE_JWT_SECRET:?set SUPABASE_JWT_SECRET to the same value the gateway uses}"
: "${SELLER_ID:?set SELLER_ID to an ACTIVE seller id (see header for a lookup command)}"

command -v curl >/dev/null 2>&1 || { echo "curl is required" >&2; exit 2; }
command -v openssl >/dev/null 2>&1 || { echo "openssl is required" >&2; exit 2; }

RUN_ID="$(date +%s)"
pass=0
fail=0
RESP=""
CODE=""

b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }

# mkjwt <sub> <app_role> <seller_id>
mkjwt() {
  local sub="$1" role="$2" seller="$3"
  local exp=$(( $(date +%s) + 3600 ))
  local header='{"alg":"HS256","typ":"JWT"}'
  local payload="{\"sub\":\"${sub}\",\"app_role\":\"${role}\",\"seller_id\":\"${seller}\",\"exp\":${exp}}"
  local h p sig
  h="$(printf '%s' "$header" | b64url)"
  p="$(printf '%s' "$payload" | b64url)"
  sig="$(printf '%s' "${h}.${p}" | openssl dgst -sha256 -hmac "$SUPABASE_JWT_SECRET" -binary | b64url)"
  printf '%s.%s.%s' "$h" "$p" "$sig"
}

# first_str <json> <key> -> first "key":"value" string value (or empty)
first_str() {
  printf '%s' "$1" | grep -o "\"$2\":\"[^\"]*\"" | head -n1 | sed "s/\"$2\":\"//; s/\"$//"
}

# http <method> <path> <token> [body] -> sets RESP (body) and CODE (status)
http() {
  local method="$1" path="$2" token="$3" body="${4:-}"
  local args=(-s -w '\n%{http_code}' -X "$method" "${GATEWAY_URL}${path}" -H "Authorization: Bearer ${token}")
  if [ -n "$body" ]; then
    args+=(-H 'Content-Type: application/json' --data "$body")
  fi
  local out
  out="$(curl "${args[@]}")"
  CODE="$(printf '%s' "$out" | tail -n1)"
  RESP="$(printf '%s' "$out" | sed '$d')"
}

check() {
  local label="$1" want="$2"
  if [ "$CODE" = "$want" ]; then
    echo "  PASS  ${label} (HTTP ${CODE})"
    pass=$((pass + 1))
    return 0
  fi
  echo "  FAIL  ${label} -> HTTP ${CODE} (want ${want}): ${RESP}"
  fail=$((fail + 1))
  return 1
}

echo "Seller product-create simulation against ${GATEWAY_URL} (run ${RUN_ID})"
echo "-----------------------------------------------------------------------"

# Preflight.
http GET /health "" || true
if [ "$CODE" != "200" ]; then
  echo "gateway not reachable at ${GATEWAY_URL}/health (HTTP ${CODE:-none})" >&2
  exit 2
fi

SELLER_TOKEN="$(mkjwt "sim-seller-${RUN_ID}" SELLER "${SELLER_ID}")"
ADMIN_TOKEN="$(mkjwt "sim-admin-${RUN_ID}" SUPER_ADMIN "")"

echo "[1] seller token minted for ${SELLER_ID}"

# 2. Resolve a store the seller owns.
STORE_ID="${STORE_ID:-${STORE:-}}"
if [ -z "$STORE_ID" ]; then
  echo "[2] GET /seller/stores"
  http GET /seller/stores "$SELLER_TOKEN"
  if ! check "GET /seller/stores" 200; then exit 1; fi
  STORE_ID="$(first_str "$RESP" id)"
  if [ -z "$STORE_ID" ]; then
    echo "  FAIL  no store found for seller ${SELLER_ID}" >&2
    exit 1
  fi
  echo "  PASS  picked store ${STORE_ID}"
  pass=$((pass + 1))
else
  echo "[2] using STORE_ID=${STORE_ID}"
fi

# 3. Mint a presigned upload.
echo "[3] POST /media/upload-url"
http POST /media/upload-url "$SELLER_TOKEN" \
  "{\"kind\":\"PUBLIC\",\"ownerType\":\"PRODUCT\",\"mime\":\"image/jpeg\",\"bytes\":2048}"
if ! check "POST /media/upload-url" 200; then exit 1; fi
ASSET_ID="$(first_str "$RESP" assetId)"
IMAGE_KEY="$(first_str "$RESP" key)"
if [ -z "$ASSET_ID" ] || [ -z "$IMAGE_KEY" ]; then
  echo "  FAIL  upload-url response missing assetId/key: ${RESP}" >&2
  exit 1
fi
echo "  info  asset=${ASSET_ID} key=${IMAGE_KEY} (R2 PUT simulated)"

# 4/5. Confirm the asset (DRAFT -> ACTIVE).
echo "[4] POST /media/confirm"
http POST /media/confirm "$SELLER_TOKEN" \
  "{\"assetId\":\"${ASSET_ID}\",\"ownerType\":\"PRODUCT\",\"ownerId\":\"${STORE_ID}\"}"
if ! check "POST /media/confirm" 200; then exit 1; fi

# 6. Create the product.
echo "[5] POST /seller/products"
NAME="Sim Listing ${RUN_ID}"
http POST /seller/products "$SELLER_TOKEN" \
  "{\"storeId\":\"${STORE_ID}\",\"name\":\"${NAME}\",\"category\":\"Simulation\",\"description\":\"Automated smoke listing\",\"price\":149,\"unit\":\"1 pc\",\"imageKey\":\"${IMAGE_KEY}\",\"isVeg\":true}"
if ! check "POST /seller/products" 201; then exit 1; fi
PRODUCT_ID="$(first_str "$RESP" id)"
STATUS="$(first_str "$RESP" status)"
if [ "$STATUS" != "PENDING_REVIEW" ] || [ -z "$PRODUCT_ID" ]; then
  echo "  FAIL  created product status=${STATUS:-<none>} id=${PRODUCT_ID:-<none>} (want PENDING_REVIEW)" >&2
  exit 1
fi
echo "  PASS  created ${PRODUCT_ID} status=PENDING_REVIEW"
pass=$((pass + 1))

# 7. It shows up in the seller list.
echo "[6] GET /seller/products"
http GET "/seller/products?status=PENDING_REVIEW" "$SELLER_TOKEN"
if ! check "GET /seller/products" 200; then exit 1; fi
if printf '%s' "$RESP" | grep -q "\"$PRODUCT_ID\""; then
  echo "  PASS  ${PRODUCT_ID} present in seller list"
  pass=$((pass + 1))
else
  echo "  FAIL  ${PRODUCT_ID} missing from seller list"
  fail=$((fail + 1))
fi

# 8. Set stock (qty + ETA) via the inventory surface.
echo "[7] PUT /seller/inventory/${PRODUCT_ID}"
http PUT "/seller/inventory/${PRODUCT_ID}" "$SELLER_TOKEN" '{"inStockQty":5,"etaMinutes":25}'
check "PUT /seller/inventory/{id}" 200 || true

# 9. Admin approves.
echo "[8] PUT /seller/products/${PRODUCT_ID}/status (SUPER_ADMIN)"
http PUT "/seller/products/${PRODUCT_ID}/status" "$ADMIN_TOKEN" '{"status":"ACTIVE"}'
check "PUT /seller/products/{id}/status" 200 || true
http GET "/seller/products?status=ACTIVE" "$SELLER_TOKEN"
if printf '%s' "$RESP" | grep -q "\"$PRODUCT_ID\""; then
  echo "  PASS  ${PRODUCT_ID} is now ACTIVE"
  pass=$((pass + 1))
else
  echo "  FAIL  ${PRODUCT_ID} not found under ACTIVE"
  fail=$((fail + 1))
fi

# 10. Negatives.
echo "[9] negative: missing required fields -> 400"
http POST /seller/products "$SELLER_TOKEN" '{"name":"no store or category"}'
check "missing fields" 400 || true

echo "[10] negative: foreign/nonexistent store -> 404"
http POST /seller/products "$SELLER_TOKEN" \
  '{"storeId":"store-does-not-exist","name":"x","category":"y","price":1}'
check "foreign store" 404 || true

echo "-----------------------------------------------------------------------"
echo "Summary: ${pass} passed, ${fail} failed"
[ "$fail" -eq 0 ]
