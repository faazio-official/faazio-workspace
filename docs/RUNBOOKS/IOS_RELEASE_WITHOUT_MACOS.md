# iOS Release Without macOS

> Build, sign, and ship Faazio iOS releases entirely from Codemagic + a browser — no Mac required.
> GitHub Actions' `ios-release.yml` is **disabled** (kept for history/rollback); the root
> [`codemagic.yaml`](../../codemagic.yaml) is the production pipeline.

## 1. Situation

You no longer have a Mac (or never had one). All iOS work runs on Codemagic's macOS M2 build
machines (Xcode 26.3), started from the Codemagic web UI, and submitted to App Store review from a
browser. The committed `ios/` Xcode project is the source of truth; there is no prebuild step.

## 2. One-time setup

Complete these once while you have access to Apple Developer / App Store Connect:

- **Apple Developer Program enrollment** — active membership for the Faazio team.
- **App Store Connect app record** — one listing:
  - `com.faazio.customer` (Faazio)
  - The Delivery Partner and Seller Partner apps (`com.faazio.deliverypartner` /
    `com.faazio.sellerpartner`) are **Android/Play only** — they have no App Store listing and no
    planned iOS release.
- **Export the shared distribution certificate** as a `.p12` from Keychain Access.
- **Create the App Store provisioning profile** for `com.faazio.customer` (with the **Push
  Notifications** capability) in the Apple Developer Console and download the `.mobileprovision`.
- **Create an App Store Connect API key** (App Manager role) → download `AuthKey_XXXXXXXXXX.p8`.
  Note the issuer ID and key ID.
- **Back up provisioning profiles** (they are not repo files).

### 2.1 Add the app to Codemagic

1. Sign in to [codemagic.io](https://codemagic.io) and choose the Faazio team.
2. **Add application** → GitHub → `faazio-official/faazio-workspace`.
3. Select the project type and finish. Codemagic can build the committed `client/mobile/ios`
   project directly; do not run a native prebuild.
4. Push the committed [`codemagic.yaml`](../../codemagic.yaml), then click **Check for
   configuration file** in the top-right corner. The **iOS Customer Release** workflow appears.

### 2.2 Create the `ios app` variable group

App settings → **Environment variables** → create group `ios app`:

| Variable | Kind | Value |
|---|---|---|
| `APPSTORE_CERTIFICATE_BASE64` | secret | `base64 -w0 faazio-customer.p12` (single line) |
| `APPSTORE_CERTIFICATE_PASSWORD` | secret | that `.p12` password |
| `APPSTORE_PROVISIONING_PROFILE_CUSTOMER` | secret | `base64 -w0 customer.mobileprovision` (App Store, Push-enabled) |
| `APPSTORE_API_PRIVATE_KEY` | secret | contents of the App Store Connect `AuthKey_*.p8` |
| `APPSTORE_TEAM_ID` | plain | 10-char Apple Developer Team ID |
| `APPSTORE_ISSUER_ID` | plain | App Store Connect API issuer ID |
| `APPSTORE_API_KEY_ID` | plain | App Store Connect API key ID |
| `CERT_PINS` | plain | comma-separated base64 SHA-256 SPKI pins (from `scripts/cert-pins.sh`) |
| `GOOGLE_MAPS_API_KEY_IOS` | secret | restricted iOS Maps key |
| `GOOGLE_PLACES_API_KEY` | secret | Places API (New) key |

`GATEWAY_URL`, `WEB_PORTAL_URL`, `USE_GATEWAY`, `STRICT` and `USE_FIREBASE_AUTH` are set in
`codemagic.yaml`. `REQUIRE_CERT_PINS=1` makes a missing pin set fatal, so the pins must be in the
group.

See `docs/RUNBOOKS/CI_PIPELINE.md` → "iOS / App Store" for the full secrets table. The step-by-step
UI workflow for the `.p8` key is in `docs/RUNBOOKS/APPSTORE_API_KEY.md`.

The upload step normalises `APPSTORE_API_PRIVATE_KEY` through
`client/mobile/scripts/ios-appstore-key.sh`: a value stored as one line with literal `\n` escapes,
with quotes/CRLF, as a file path, or base64 is repaired before upload, so the "not a valid PEM
encoded private key" failure only means the value is not the key at all.

## 3. Every release (from Linux)

```bash
cd client/mobile
# Bump package.json version first, or enter the version in Codemagic.
# Push to main — Codemagic builds the pushed branch, not your local tree.
git push origin main
```

Then in Codemagic (manual trigger — the committed [`codemagic.yaml`](../../codemagic.yaml) is the CI
config; there is no automatic GitHub trigger):

1. Open the Faazio application → **Start new build**.
2. Select branch `main` and workflow **iOS Customer Release**.
3. Optionally enter `version` (e.g. `1.0.6`); blank uses `package.json`. To rebuild the current
   marketing version, leave it blank — the timestamp build number still increases.
4. Start the build.

Codemagic signs, exports, verifies, and uploads the `.ipa` to App Store Connect automatically; it
appears under **TestFlight → Builds**. The IPA is also kept as a Codemagic artifact. No GitHub
Release is created.

Then in the browser:

1. Open https://appstoreconnect.apple.com/.
2. **My Apps → your app → TestFlight → Builds** → the Codemagic build appears there.
3. **App Store → Add Build → select the build → submit for review**.

Inviting TestFlight testers is optional — you can submit the build directly to App Store review.

## 4. TestFlight: skip or not?

TestFlight is the **upload pipe**, not a testing requirement:

- Every successful Codemagic build uploads to App Store Connect; the build appears under
  **TestFlight → Builds**, and you submit it for review from the browser.
- You do **not** need to invite internal or external testers to submit for review. Direct App Store
  review submission is done entirely in the browser.
- `codemagic.yaml` deliberately does not submit the build for **beta review** or **App Store
  review**; those remain manual.

## 5. Rollback to GitHub Actions

The GitHub workflow is disabled, not deleted. If Codemagic is unavailable:

```bash
gh workflow enable "Release iOS"
gh workflow run ios-release.yml -f app=customer -f version=1.0.6
gh run watch
```

The GitHub secrets listed in `docs/RUNBOOKS/CI_PIPELINE.md` must still be present for that path.

## 6. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `restore-ios-signing.sh` fails | `APPSTORE_CERTIFICATE_BASE64`, `APPSTORE_CERTIFICATE_PASSWORD`, `APPSTORE_TEAM_ID`, or `APPSTORE_PROVISIONING_PROFILE_CUSTOMER` missing/wrong | Check the `ios app` group; confirm the profile is an **App Store** profile for `com.faazio.customer` |
| Archive/export signing error | Profile bundle id doesn't match the built config; `APPSTORE_TEAM_ID` doesn't own the cert/profile; or a keychain restored in an earlier step is locked. The workflow restores signing, applies it with `xcode-project use-profiles`, and archives/exports in one step — check its `security find-identity` output | Confirm `com.faazio.customer` and team ownership |
| App Store Connect upload fails | `APPSTORE_ISSUER_ID`/`APPSTORE_API_KEY_ID` or `APPSTORE_API_PRIVATE_KEY` wrong; API key lacks App Manager role | Verify the group; confirm the `.p8` key has the App Manager role |
| Build not appearing in TestFlight | App Store Connect rejects a build number that is not higher than the last upload. The workflow generates a UTC-timestamp build number (`YYYYMMDDHHmm`) on every run | Re-run the workflow so it produces a higher `CURRENT_PROJECT_VERSION`; bump `version` only when you intend a new App Store version |
| `Check for configuration file` finds nothing | `codemagic.yaml` is not at the repository root or was not pushed | Commit/push it, then re-check the branch in Codemagic |
| CocoaPods/SPM dependency failure | Stale cache or a new native dependency | Clear the workflow cache in Codemagic and rebuild |

Build logs live on the Codemagic build page; the failing script step and its full output are shown
inline.
