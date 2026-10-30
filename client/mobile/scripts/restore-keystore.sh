#!/usr/bin/env bash
#
# restore-keystore.sh <customer|delivery|seller>
#
# Reconstructs ONE product's release keystore + signing properties in CI from
# GitHub secrets. Each product signs with its own keystore:
#
#   customer -> keystore/keystore.properties            (faazio-release.keystore)
#   delivery -> keystore/keystore-delivery.properties   (faazio-delivery-release.keystore)
#   seller   -> keystore/keystore-seller.properties     (faazio-seller-release.keystore)
#
# Required env vars (suffix = uppercase app, e.g. _DELIVERY):
#   KEYSTORE_BASE64_<APP>  base64 of client/mobile/keystore/<store file>
#   KEYSTORE_PASS_<APP>    store password
#   KEY_ALIAS_<APP>        key alias
#   ALIAS_PASS_<APP>       key password
#   STORE_FILE_<APP>       (optional) keystore file name
#
# Usage:  scripts/restore-keystore.sh customer   # run from client/mobile/
set -euo pipefail

APP="${1:-customer}"
case "$APP" in
  customer) SUFFIX="_CUSTOMER"; STORE_DEFAULT="faazio-release.keystore";          PROPS="keystore.properties" ;;
  delivery) SUFFIX="_DELIVERY"; STORE_DEFAULT="faazio-delivery-release.keystore"; PROPS="keystore-delivery.properties" ;;
  seller)   SUFFIX="_SELLER";   STORE_DEFAULT="faazio-seller-release.keystore";   PROPS="keystore-seller.properties" ;;
  *) echo "[restore-keystore] unknown app '$APP' (expected customer|delivery|seller)" >&2; exit 1 ;;
esac

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KEYSTORE_DIR="$ROOT/keystore"

base64_var="KEYSTORE_BASE64${SUFFIX}"
pass_var="KEYSTORE_PASS${SUFFIX}"
alias_var="KEY_ALIAS${SUFFIX}"
alias_pass_var="ALIAS_PASS${SUFFIX}"
store_var="STORE_FILE${SUFFIX}"

: "${!base64_var:?${base64_var} secret is required}"
: "${!pass_var:?${pass_var} secret is required}"
: "${!alias_var:?${alias_var} secret is required}"
: "${!alias_pass_var:?${alias_pass_var} secret is required}"

STORE_FILE="${!store_var:-$STORE_DEFAULT}"

mkdir -p "$KEYSTORE_DIR"

# 1. Decode the keystore from the base64 secret.
printf '%s' "${!base64_var}" | base64 -d > "$KEYSTORE_DIR/$STORE_FILE"
chmod 600 "$KEYSTORE_DIR/$STORE_FILE"
echo "[restore-keystore] wrote $KEYSTORE_DIR/$STORE_FILE ($APP)"

# 2. Write the product's properties file (relative STORE_FILE, as build.gradle expects).
cat > "$KEYSTORE_DIR/$PROPS" <<EOF
KEYSTORE_PASS=${!pass_var}
ALIAS_PASS=${!alias_pass_var}
STORE_FILE=../../keystore/$STORE_FILE
KEY_ALIAS=${!alias_var}
EOF
chmod 600 "$KEYSTORE_DIR/$PROPS"
echo "[restore-keystore] wrote $KEYSTORE_DIR/$PROPS ($APP)"
