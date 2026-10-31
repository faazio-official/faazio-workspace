#!/usr/bin/env bash
#
# restore-ios-signing.sh <customer|delivery|seller>
#
# Reconstructs ONE iOS product's App Store signing material in CI from GitHub
# secrets, using Apple's own tooling (no fastlane):
#   1. imports the shared Apple Distribution certificate into a temp keychain
#   2. installs that product's App Store provisioning profile
#   3. writes ios/ExportOptions.plist (manual signing, method app-store-connect)
#
# One shared distribution certificate signs all three products; each product has
# its own App Store provisioning profile (distinct bundle id).
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
  customer) SUFFIX="_CUSTOMER"; BUNDLE_ID="com.faazio.customer";        CONFIG="Release" ;;
  delivery) SUFFIX="_DELIVERY"; BUNDLE_ID="com.faazio.deliverypartner"; CONFIG="Delivery-Release" ;;
  seller)   SUFFIX="_SELLER";   BUNDLE_ID="com.faazio.sellerpartner";   CONFIG="Seller-Release" ;;
  *) echo "[restore-ios-signing] unknown app '$APP' (expected customer|delivery|seller)" >&2; exit 1 ;;
esac

: "${APPSTORE_CERTIFICATE_BASE64:?APPSTORE_CERTIFICATE_BASE64 secret is required}"
: "${APPSTORE_CERTIFICATE_PASSWORD:?APPSTORE_CERTIFICATE_PASSWORD secret is required}"
: "${APPSTORE_TEAM_ID:?APPSTORE_TEAM_ID is required (Apple Developer Team ID)}"
profile_var="APPSTORE_PROVISIONING_PROFILE${SUFFIX}"
: "${!profile_var:?${profile_var} secret is required}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="${RUNNER_TEMP:-$(mktemp -d)}"
KEYCHAIN_PASSWORD="${KEYCHAIN_PASSWORD:-$(openssl rand -hex 16)}"

CERT_PATH="$TMP/ios_signing_certificate.p12"
PP_PATH="$TMP/ios_signing_profile.mobileprovision"
KEYCHAIN_PATH="$TMP/ios-signing.keychain-db"

# 1. Decode the certificate + profile from their base64 secrets.
printf '%s' "$APPSTORE_CERTIFICATE_BASE64" | base64 --decode > "$CERT_PATH"
printf '%s' "${!profile_var}" | base64 --decode > "$PP_PATH"

# 2. Import the certificate into a dedicated temporary keychain (GitHub Docs boilerplate).
security create-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"
security set-keychain-settings -lut 21600 "$KEYCHAIN_PATH"
security unlock-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"
security import "$CERT_PATH" -P "$APPSTORE_CERTIFICATE_PASSWORD" -A -t cert -f pkcs12 -k "$KEYCHAIN_PATH"
security set-key-partition-list -S apple-tool:,apple: -k "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH" >/dev/null
# Put the temp keychain first so xcodebuild/codesign find the distribution identity.
security list-keychains -d user -s "$KEYCHAIN_PATH" $(security list-keychains -d user | tr -d '"')
security default-keychain -s "$KEYCHAIN_PATH"

# 3. Install the provisioning profile. Xcode 16 reads
#    ~/Library/Developer/Xcode/UserData/Provisioning Profiles; older Xcode reads
#    ~/Library/MobileDevice/Provisioning Profiles. Install into both, named by the
#    profile's embedded UUID (xcodebuild discovers profiles by UUID/name).
PP_PLIST="$TMP/ios_signing_profile.plist"
security cms -D -i "$PP_PATH" > "$PP_PLIST"
PP_UUID="$(plutil -extract UUID raw "$PP_PLIST")"
PP_NAME="$(plutil -extract Name raw "$PP_PLIST")"
for DIR in \
  "$HOME/Library/MobileDevice/Provisioning Profiles" \
  "$HOME/Library/Developer/Xcode/UserData/Provisioning Profiles"; do
  mkdir -p "$DIR"
  cp "$PP_PATH" "$DIR/$PP_UUID.mobileprovision"
done

# 4. Write ExportOptions.plist for the archive export step (manual signing).
cat > "$ROOT/ios/ExportOptions.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>app-store-connect</string>
  <key>signingStyle</key>
  <string>manual</string>
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
