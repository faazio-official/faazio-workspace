#!/bin/sh
# Inject the Firebase Phone Auth callback URL scheme into the built Info.plist.
#
# FirebaseAuth derives the reCAPTCHA callback scheme from the active
# GoogleService-Info.plist as `app-<GOOGLE_APP_ID with : replaced by ->`. When the
# built Info.plist does not declare that scheme, PhoneAuthProvider.verifyPhoneNumber()
# calls fatalError() before any network call (SIGTRAP, "Please register custom URL
# scheme ... in the app's Info.plist file").
#
# Reading the plist Xcode actually bundles keeps the customer, delivery and seller
# products correct even when the partner plists are supplied by CI from their own
# Firebase iOS apps (their GOOGLE_APP_ID differs from the customer app).
#
# Runs at the end of the "Delivery Firebase config" build phase, after the partner
# GoogleService plist (if any) has been copied over the bundled customer one.

set -eu

PLIST_BUDDY=/usr/libexec/PlistBuddy
GOOGLE_PLIST="${TARGET_BUILD_DIR}/${UNLOCALIZED_RESOURCES_FOLDER_PATH}/GoogleService-Info.plist"
INFO_PLIST="${BUILT_PRODUCTS_DIR}/${INFOPLIST_PATH}"

if [ ! -f "${GOOGLE_PLIST}" ] || [ ! -f "${INFO_PLIST}" ]; then
  exit 0
fi

APP_ID="$("${PLIST_BUDDY}" -c "Print :GOOGLE_APP_ID" "${GOOGLE_PLIST}" 2>/dev/null || true)"
if [ -z "${APP_ID}" ]; then
  exit 0
fi

SCHEME="app-$(printf '%s' "${APP_ID}" | tr ':' '-')"

# CFBundleURLTypes can be absent on a new/minimal variant plist.
if ! "${PLIST_BUDDY}" -c "Print :CFBundleURLTypes" "${INFO_PLIST}" >/dev/null 2>&1; then
  "${PLIST_BUDDY}" -c "Add :CFBundleURLTypes array" "${INFO_PLIST}"
fi

# Idempotent: incremental builds re-run this phase after Xcode re-processes the plist.
if "${PLIST_BUDDY}" -c "Print :CFBundleURLTypes" "${INFO_PLIST}" | grep -qF "${SCHEME}"; then
  exit 0
fi

COUNT="$("${PLIST_BUDDY}" -c "Print :CFBundleURLTypes" "${INFO_PLIST}" | grep -c "Dict {" || true)"
INDEX="${COUNT:-0}"
"${PLIST_BUDDY}" -c "Add :CFBundleURLTypes:${INDEX} dict" "${INFO_PLIST}"
"${PLIST_BUDDY}" -c "Add :CFBundleURLTypes:${INDEX}:CFBundleURLSchemes array" "${INFO_PLIST}"
"${PLIST_BUDDY}" -c "Add :CFBundleURLTypes:${INDEX}:CFBundleURLSchemes:0 string ${SCHEME}" "${INFO_PLIST}"
echo "note: added Firebase Auth URL scheme ${SCHEME} to ${INFO_PLIST}"
