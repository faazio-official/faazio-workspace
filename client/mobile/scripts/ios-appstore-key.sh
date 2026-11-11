#!/usr/bin/env bash
#
# ios-appstore-key.sh
#
# Materialises the App Store Connect API private key (.p8) for
# `app-store-connect publish` from whichever variable Codemagic holds it in:
#   APPSTORE_API_PRIVATE_KEY                 (the "ios app" variable group)
#   APP_STORE_CONNECT_PUBLISHER_PRIVATE_KEY  (Developer Portal integration "publisher")
#
# A key pasted through a single-line UI field often arrives with literal "\n"
# sequences, wrapping quotes, CRLF or base64 instead of the PEM body. Apple's
# tooling rejects those with:
#   "Provided value is not a valid PEM encoded private key"
# so normalise the value here, validate it with openssl and hand the CLI a real
# file. Key material is never logged.
#
# Usage (from client/mobile/, e.g. in codemagic.yaml):
#   source scripts/ios-appstore-key.sh
#   app-store-connect publish --private-key "@file:$APPSTORE_KEY_FILE" ...
#
# Exports: APPSTORE_KEY_FILE, APPSTORE_KEY_ID, APPSTORE_ISSUER_ID
set -euo pipefail

log() { echo "[ios-appstore-key] $*"; }

# Value of the first non-empty variable from the argument list.
pick() {
  local name value
  for name in "$@"; do
    value="$(printenv "$name" 2>/dev/null || true)"
    if [[ -n "${value//[[:space:]]/}" ]]; then
      printf '%s' "$value"
      return 0
    fi
  done
  return 1
}

RAW="$(pick APPSTORE_API_PRIVATE_KEY APP_STORE_CONNECT_PUBLISHER_PRIVATE_KEY APP_STORE_CONNECT_PRIVATE_KEY || true)"
if [[ -z "${RAW//[[:space:]]/}" ]]; then
  echo "[ios-appstore-key] no App Store Connect API key found." >&2
  echo "[ios-appstore-key] Add APPSTORE_API_PRIVATE_KEY (the full .p8 contents) to the 'ios app' group," >&2
  echo "[ios-appstore-key] or connect the Developer Portal integration in Codemagic." >&2
  exit 1
fi

APPSTORE_KEY_ID="$(pick APPSTORE_API_KEY_ID APP_STORE_CONNECT_PUBLISHER_KEY_IDENTIFIER APP_STORE_CONNECT_KEY_IDENTIFIER || true)"
APPSTORE_ISSUER_ID="$(pick APPSTORE_ISSUER_ID APP_STORE_CONNECT_PUBLISHER_ISSUER_ID APP_STORE_CONNECT_ISSUER_ID || true)"
APPSTORE_KEY_ID="${APPSTORE_KEY_ID//[[:space:]]/}"
APPSTORE_ISSUER_ID="${APPSTORE_ISSUER_ID//[[:space:]]/}"
if [[ -z "$APPSTORE_KEY_ID" || -z "$APPSTORE_ISSUER_ID" ]]; then
  echo "[ios-appstore-key] APPSTORE_API_KEY_ID and APPSTORE_ISSUER_ID are required" >&2
  exit 1
fi

TMP="${RUNNER_TEMP:-${TMPDIR:-/tmp}}"
mkdir -p "$TMP"
KEY="$TMP/AuthKey_${APPSTORE_KEY_ID}.p8"

value="$RAW"
value="${value//$'\r'/}"
# UI fields that escape newlines store the key as one line with literal \n.
value="${value//\\r/$'\n'}"
value="${value//\\n/$'\n'}"
value="${value//\\t/}"
trim() { printf '%s' "$1" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//'; }
value="$(trim "$value")"

# A quoted JSON/CSV export wraps the whole body in quotes.
while (( ${#value} >= 2 )) && [[ "$value" == \"*\" && "$value" == *\" ]]; do
  value="$(trim "${value:1:${#value}-2}")"
done
while (( ${#value} >= 2 )) && [[ "$value" == \'*\' && "$value" == *\' ]]; do
  value="$(trim "${value:1:${#value}-2}")"
done

# Some setups store the path to the .p8 instead of its contents.
if [[ "$value" != *"-----BEGIN"* && -f "$value" ]]; then
  value="$(cat "$value")"
fi

# Pure base64: either the whole PEM text, or the raw DER/PKCS#8 body.
if [[ "$value" != *"-----BEGIN"* ]]; then
  compact="$(printf '%s' "$value" | tr -d '[:space:]')"
  if [[ "$compact" =~ ^[A-Za-z0-9+/=]+$ ]]; then
    decoded="$TMP/appstore-key.decoded"
    der="$TMP/appstore-key.der"
    if printf '%s' "$compact" | base64 --decode > "$decoded" 2>/dev/null ||
      printf '%s' "$compact" | base64 -D > "$decoded" 2>/dev/null; then
      if grep -q -- "-----BEGIN" "$decoded"; then
        value="$(cat "$decoded")"
      elif openssl pkey -inform DER -in "$decoded" -out "$der" 2>/dev/null; then
        value="$(cat "$der")"
      fi
    fi
    rm -f "$decoded" "$der"
  fi
fi

if [[ "$value" != *"-----BEGIN"* || "$value" != *"-----END"* ]]; then
  literal_newlines="$(printf '%s' "$RAW" | { grep -oF '\n' || true; } | wc -l | tr -d ' ')"
  echo "[ios-appstore-key] the App Store Connect API key is not PEM." >&2
  echo "[ios-appstore-key] Expected the whole AuthKey_*.p8 contents," >&2
  echo "[ios-appstore-key] from -----BEGIN PRIVATE KEY----- to -----END PRIVATE KEY-----." >&2
  echo "[ios-appstore-key] value length: ${#value}; literal '\\n' sequences: ${literal_newlines}"
  exit 1
fi

printf '%s\n' "$value" > "$KEY"
chmod 600 "$KEY"

if command -v openssl >/dev/null 2>&1; then
  if ! openssl pkey -in "$KEY" -noout 2>/dev/null && ! openssl ec -in "$KEY" -noout 2>/dev/null; then
    echo "[ios-appstore-key] the key looks like PEM but openssl cannot parse it." >&2
    echo "[ios-appstore-key] Re-download AuthKey_*.p8 from App Store Connect and paste the whole file into APPSTORE_API_PRIVATE_KEY." >&2
    exit 1
  fi
fi

export APPSTORE_KEY_FILE="$KEY"
export APPSTORE_KEY_ID APPSTORE_ISSUER_ID
log "App Store Connect key ready (key id ${APPSTORE_KEY_ID}, issuer ${APPSTORE_ISSUER_ID:0:8}...)"
