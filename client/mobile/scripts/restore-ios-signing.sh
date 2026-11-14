#!/usr/bin/env bash
#
# restore-ios-signing.sh <customer>
#
# Reconstructs ONE iOS product's App Store signing material in CI from GitHub
# secrets, using Apple's own tooling (no fastlane):
#   1. imports the shared Apple Distribution certificate into a temp keychain
#   2. installs that product's App Store provisioning profile
#   3. writes ios/ExportOptions.plist (manual signing, method app-store-connect)
#
# The customer app (com.faazio.customer) is the only iOS/App Store product. The
# Apple Distribution certificate signs it; its App Store provisioning profile
# must belong to that bundle id.
#
# Required env vars:
#   APPSTORE_CERTIFICATE_BASE64          base64 of the shared distribution .p12
#   APPSTORE_CERTIFICATE_PASSWORD        password for the .p12
#   APPSTORE_TEAM_ID                     Apple Developer Team ID
#   APPSTORE_PROVISIONING_PROFILE_<APP>  base64 of that app's App Store .mobileprovision
# Optional:
#   KEYCHAIN_PASSWORD                    random string; generated when unset
#   RUNNER_TEMP                          temp dir (GitHub runner); a mktemp dir otherwise
#   GITHUB_OUTPUT                        when set, profile_name/bundle_id/configuration are exported
#
# Usage:  scripts/restore-ios-signing.sh customer   # run from client/mobile/
set -euo pipefail

APP="${1:-customer}"
case "$APP" in
  customer) SUFFIX="_CUSTOMER"; BUNDLE_ID="com.faazio.customer"; CONFIG="Release" ;;
  *) echo "[restore-ios-signing] unknown app '$APP' (expected customer)" >&2; exit 1 ;;
esac

: "${APPSTORE_CERTIFICATE_BASE64:?APPSTORE_CERTIFICATE_BASE64 secret is required}"
: "${APPSTORE_CERTIFICATE_PASSWORD:?APPSTORE_CERTIFICATE_PASSWORD secret is required}"
: "${APPSTORE_TEAM_ID:?APPSTORE_TEAM_ID is required (Apple Developer Team ID)}"
# A pasted trailing newline/space would silently make Xcode search the wrong team.
APPSTORE_TEAM_ID="${APPSTORE_TEAM_ID//[[:space:]]/}"
profile_var="APPSTORE_PROVISIONING_PROFILE${SUFFIX}"
: "${!profile_var:?${profile_var} secret is required}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="${RUNNER_TEMP:-$(mktemp -d)}"
KEYCHAIN_PASSWORD="${KEYCHAIN_PASSWORD:-$(openssl rand -hex 16)}"

CERT_PATH="$TMP/ios_signing_certificate.p12"
PP_PATH="$TMP/ios_signing_profile.mobileprovision"
KEYCHAIN_PATH="$TMP/ios-signing.keychain-db"

# 1. Decode the certificate + profile from their base64 secrets. GNU base64
#    (Linux, Homebrew coreutils) accepts --decode; the BSD base64 shipped with
#    macOS only accepts -D, so try both.
decode_base64() {
  local src="$1" dest="$2"
  if ! base64 --decode < "$src" > "$dest" 2>/dev/null; then
    base64 -D < "$src" > "$dest"
  fi
}
printf '%s' "$APPSTORE_CERTIFICATE_BASE64" > "$TMP/signing-certificate.b64"
printf '%s' "${!profile_var}" > "$TMP/signing-profile.b64"
decode_base64 "$TMP/signing-certificate.b64" "$CERT_PATH"
decode_base64 "$TMP/signing-profile.b64" "$PP_PATH"

# 2. Import the certificate into a dedicated temporary keychain. Do not pass
#    `-t cert`: for a PKCS#12 it can import only the certificate and drop the
#    private key, leaving no usable code-signing identity. -A grants codesign
#    access; the partition list (with -s) is still required on modern macOS.
#    A .p12 may itself contain the WWDR intermediate; a duplicate item is not
#    an error (the identity check below is the real gate).
import_item() {
  local log="$TMP/keychain-import.log" rc=0
  security import "$@" >"$log" 2>&1 || rc=$?
  if (( rc != 0 )); then
    if grep -q "The specified item already exists" "$log"; then
      echo "[restore-ios-signing] keychain item already present; continuing"
    else
      cat "$log" >&2
      return "$rc"
    fi
  fi
  return 0
}
security delete-keychain "$KEYCHAIN_PATH" 2>/dev/null || true
security create-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"
security set-keychain-settings -lut 21600 "$KEYCHAIN_PATH"
security unlock-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"
import_item "$CERT_PATH" -P "$APPSTORE_CERTIFICATE_PASSWORD" -A -f pkcs12 \
  -T /usr/bin/codesign -T /usr/bin/security -T /usr/bin/productbuild \
  -k "$KEYCHAIN_PATH"
security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH" >/dev/null
# Put the temp keychain first so xcodebuild/codesign find the distribution identity.
security list-keychains -d user -s "$KEYCHAIN_PATH" $(security list-keychains -d user | tr -d '"')
security default-keychain -s "$KEYCHAIN_PATH"

# 2b. The leaf "Apple Distribution" certificate is issued by Apple WWDR CA G3.
#     Import the intermediate so the temporary keychain can build a trusted
#     chain (copied from Apple's public certificate authority page). If the
#     .p12 already carried it, the duplicate is tolerated by import_item.
WWDR_PATH="$TMP/AppleWWDRCAG3.cer"
if curl -fsSL --retry 3 -o "$WWDR_PATH" \
  https://www.apple.com/certificateauthority/AppleWWDRCAG3.cer; then
  import_item "$WWDR_PATH" -k "$KEYCHAIN_PATH" \
    -T /usr/bin/codesign -T /usr/bin/security
else
  echo "[restore-ios-signing] warning: could not download the Apple WWDR G3 intermediate; relying on the build image keychains" >&2
fi

# 2c. Fail fast, with a useful message, if that did not yield a usable identity.
IDENTITIES="$(security find-identity -v -p codesigning "$KEYCHAIN_PATH")"
echo "$IDENTITIES"
if ! printf '%s\n' "$IDENTITIES" | grep -q "Apple Distribution"; then
  echo "[restore-ios-signing] no valid 'Apple Distribution' identity in $KEYCHAIN_PATH." >&2
  echo "[restore-ios-signing] check APPSTORE_CERTIFICATE_BASE64/APPSTORE_CERTIFICATE_PASSWORD and the WWDR intermediate." >&2
  exit 1
fi
# The SHA-1 identifies the exact identity. Xcode 26 names the requested
# app-store certificate "iOS Distribution" even though the certificate is
# "Apple Distribution"; matching by fingerprint avoids that name/type mismatch.
CERT_SHA1="$(printf '%s\n' "$IDENTITIES" | awk '/Apple Distribution/ {print $2; exit}')"
CERT_NAME="$(printf '%s\n' "$IDENTITIES" | sed -n 's/.*"\(Apple Distribution[^"]*\)".*/\1/p' | head -1)"
echo "[restore-ios-signing] identity sha1=$CERT_SHA1 name=\"$CERT_NAME\""
# The workflow pins the export options to this exact identity.
printf '%s' "$CERT_SHA1" > "$TMP/identity-sha1"
# Prove the keychain grants codesign access before paying for the whole export.
# Sign a copy of a Mach-O binary (codesign rejects plain text files).
cp /bin/echo "$TMP/sign-probe"
codesign --force --sign "$CERT_SHA1" --keychain "$KEYCHAIN_PATH" "$TMP/sign-probe"
rm -f "$TMP/sign-probe"

# 3. Install the provisioning profile. Xcode 16 reads
#    ~/Library/Developer/Xcode/UserData/Provisioning Profiles; older Xcode reads
#    ~/Library/MobileDevice/Provisioning Profiles. Install into both, named by the
#    profile's embedded UUID (xcodebuild discovers profiles by UUID/name).
PP_PLIST="$TMP/ios_signing_profile.plist"
security cms -D -i "$PP_PATH" > "$PP_PLIST"
PP_UUID="$(plutil -extract UUID raw "$PP_PLIST")"
PP_NAME="$(plutil -extract Name raw "$PP_PLIST")"
PP_TEAM="$(plutil -extract TeamIdentifier.0 raw "$PP_PLIST")"
if [[ "$PP_TEAM" != "$APPSTORE_TEAM_ID" ]]; then
  echo "[restore-ios-signing] APPSTORE_TEAM_ID (${APPSTORE_TEAM_ID}) does not match the profile team (${PP_TEAM})." >&2
  echo "[restore-ios-signing] export would find no certificate or profile for the requested team." >&2
  exit 1
fi
if ! printf '%s\n' "$IDENTITIES" | grep -q "($APPSTORE_TEAM_ID)"; then
  echo "[restore-ios-signing] the imported identity is not for team ${APPSTORE_TEAM_ID}." >&2
  exit 1
fi
for DIR in \
  "$HOME/Library/MobileDevice/Provisioning Profiles" \
  "$HOME/Library/Developer/Xcode/UserData/Provisioning Profiles"; do
  mkdir -p "$DIR"
  cp "$PP_PATH" "$DIR/$PP_UUID.mobileprovision"
done

# 4. Write ExportOptions.plist for the archive export step (manual signing).
#    signingCertificate is the SHA-1 fingerprint, not the display name.
cat > "$ROOT/ios/ExportOptions.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>app-store-connect</string>
  <key>signingStyle</key>
  <string>manual</string>
  <key>signingCertificate</key>
  <string>${CERT_SHA1}</string>
  <key>teamID</key>
  <string>${APPSTORE_TEAM_ID}</string>
  <key>uploadSymbols</key>
  <true/>
  <key>stripSwiftSymbols</key>
  <true/>
  <key>compileBitcode</key>
  <false/>
  <key>provisioningProfiles</key>
  <dict>
    <key>${BUNDLE_ID}</key>
    <string>${PP_NAME}</string>
  </dict>
</dict>
</plist>
EOF

# 5. Surface the values the workflow needs to archive/export.
echo "[restore-ios-signing] app=$APP bundle=$BUNDLE_ID config=$CONFIG profile=\"$PP_NAME\" uuid=$PP_UUID"
if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    echo "profile_name=$PP_NAME"
    echo "bundle_id=$BUNDLE_ID"
    echo "configuration=$CONFIG"
  } >> "$GITHUB_OUTPUT"
fi
