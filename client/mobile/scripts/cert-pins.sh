#!/usr/bin/env bash
#
# cert-pins.sh — derive the Android certificate-pin values for a TLS host.
#
# Prints a comma-separated CERT_PINS value: the base64 SHA-256 SPKI pins of the
# leaf certificate and its issuing intermediate, in the order the host serves
# them. Use it for BOTH `client/mobile/.env` (local release configure) and the
# `CERT_PINS` GitHub secret (CI release builds).
#
# Android's network-security-config accepts a connection when ANY certificate in
# the presented chain matches a pin, so pinning the leaf *and* its intermediate
# CA survives routine edge-cert rotation (Cloudflare / Let's Encrypt reissue
# every ~90 days) without shipping a new app build. Never pin the root.
#
# Usage:
#   scripts/cert-pins.sh                       # defaults to api.faazio.com:443
#   scripts/cert-pins.sh api.faazio.com
#   scripts/cert-pins.sh api.faazio.com 443
#
# The human-readable subject -> pin mapping goes to stderr; only the
# comma-separated pin list goes to stdout, so it can be captured directly:
#   CERT_PINS="$(scripts/cert-pins.sh)"
set -euo pipefail

HOST="${1:-api.faazio.com}"
PORT="${2:-443}"

command -v openssl >/dev/null 2>&1 || {
  echo "[cert-pins] ERROR: openssl is required" >&2
  exit 1
}

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Split the served chain into one file per certificate (cert1 = leaf, cert2 = intermediate).
echo | openssl s_client -connect "${HOST}:${PORT}" -servername "$HOST" -showcerts 2>/dev/null \
  | awk -v d="$TMP" '/BEGIN CERTIFICATE/{n++} n>=1{print > (d "/cert" n ".pem")}'

[ -s "$TMP/cert1.pem" ] || {
  echo "[cert-pins] ERROR: no certificate returned by ${HOST}:${PORT}" >&2
  exit 1
}

pins=""
for f in "$TMP/cert1.pem" "$TMP/cert2.pem"; do
  [ -s "$f" ] || continue
  pin="$(openssl x509 -in "$f" -pubkey -noout \
    | openssl pkey -pubin -outform der \
    | openssl dgst -sha256 -binary \
    | openssl base64)"
  subject="$(openssl x509 -in "$f" -noout -subject | sed 's/^subject=//')"
  echo "[cert-pins] ${subject} -> ${pin}" >&2
  pins="${pins:+${pins},}${pin}"
done

echo "$pins"
