#!/usr/bin/env bash
#
# restore-keystore.sh
#
# Reconstructs the release keystore + keystore.properties in CI from GitHub
# secrets. The keystore binary is never committed (gitignored); it is stored as
# a base64-encoded GitHub secret (KEYSTORE_BASE64). The signing properties are
# stored as plain-text secrets (KEYSTORE_PASS, KEY_ALIAS, ALIAS_PASS).
#
# Required env vars:
#   KEYSTORE_BASE64  base64 of client/mobile/keystore/faazio-release.keystore
#   KEYSTORE_PASS    store password
#   KEY_ALIAS        key alias
#   ALIAS_PASS       key password
#   STORE_FILE       keystore file name (default: faazio-release.keystore)
#
# Usage:  scripts/restore-keystore.sh
# Run from:  client/mobile/  (the Expo project root)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KEYSTORE_DIR="$ROOT/keystore"

: "${KEYSTORE_BASE64:?KEYSTORE_BASE64 secret is required}"
: "${KEYSTORE_PASS:?KEYSTORE_PASS secret is required}"
: "${KEY_ALIAS:?KEY_ALIAS secret is required}"
: "${ALIAS_PASS:?ALIAS_PASS secret is required}"
STORE_FILE="${STORE_FILE:-faazio-release.keystore}"

mkdir -p "$KEYSTORE_DIR"

# 1. Decode the keystore from the base64 secret.
echo "$KEYSTORE_BASE64" | base64 -d > "$KEYSTORE_DIR/$STORE_FILE"
chmod 600 "$KEYSTORE_DIR/$STORE_FILE"
echo "[restore-keystore] wrote $KEYSTORE_DIR/$STORE_FILE"

# 2. Write keystore.properties (relative STORE_FILE, as build.gradle expects).
cat > "$KEYSTORE_DIR/keystore.properties" <<EOF
KEYSTORE_PASS=$KEYSTORE_PASS
ALIAS_PASS=$ALIAS_PASS
STORE_FILE=../../keystore/$STORE_FILE
KEY_ALIAS=$KEY_ALIAS
EOF
chmod 600 "$KEYSTORE_DIR/keystore.properties"
echo "[restore-keystore] wrote $KEYSTORE_DIR/keystore.properties"
