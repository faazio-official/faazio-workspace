# iOS Release Without macOS

> Build, sign, and ship Faazio iOS releases entirely from GitHub Actions + a browser — no Mac required.

## 1. Situation

You no longer have a Mac (or never had one). All iOS work happens via GitHub Actions on
`macos-15-intel` runners (or `macos-15` arm64 with `-f runner=macos-15`), triggered from Linux with
the `gh` CLI, and submitted to App Store review from a browser.
The committed `ios/` Xcode project is the source of truth; CI builds the `.ipa` on Apple's own
runners using Xcode 26.3.

## 2. One-time setup (done on the Mac before giving it back)

Complete these once while you still have access to a Mac and Apple Developer / App Store Connect:

- **Apple Developer Program enrollment** — active membership for the Faazio team.
- **App Store Connect app record** — one listing:
  - `com.faazio.customer` (Faazio)
  - The Delivery Partner and Seller Partner apps (`com.faazio.deliverypartner` / `com.faazio.sellerpartner`)
    are **Android/Play only** — they have no App Store listing and no planned iOS release.
- **Export the shared distribution certificate** as a `.p12` from Keychain Access →
  `APPSTORE_CERTIFICATE_BASE64` + `APPSTORE_CERTIFICATE_PASSWORD`.
- **Create the App Store provisioning profile** for `com.faazio.customer` (with the **Push
  Notifications** capability) in the Apple Developer Console → download `.mobileprovision` →
  base64-encode → `APPSTORE_PROVISIONING_PROFILE_CUSTOMER`.
- **Create an App Store Connect API key** (App Manager role) → download `AuthKey_XXXXXXXXXX.p8` →
  `APPSTORE_API_PRIVATE_KEY`. Note the issuer ID → `APPSTORE_ISSUER_ID` and key ID →
  `APPSTORE_API_KEY_ID`.
- **Back up provisioning profiles** (they are not repo files).
- **Configure GitHub secrets** (copy exact names from `.github/workflows/ios-release.yml`):
  - `APPSTORE_CERTIFICATE_BASE64`, `APPSTORE_CERTIFICATE_PASSWORD`
  - `APPSTORE_PROVISIONING_PROFILE_CUSTOMER`
  - `APPSTORE_API_PRIVATE_KEY`
  - `APPSTORE_TEAM_ID` (variable or secret)
  - `APPSTORE_ISSUER_ID`, `APPSTORE_API_KEY_ID` (variables or secrets)
  - `CERT_PINS` (from `scripts/cert-pins.sh`)

See `docs/RUNBOOKS/CI_PIPELINE.md` → "iOS / App Store" for the full secrets table.

## 3. Every release (from Linux)

```bash
cd client/mobile
# Bump package.json version first (or pass -f version=<semver>).
gh workflow run ios-release.yml -f app=customer -f version=1.0.6 -f tag=v1.0.6
gh run watch
gh run view --log-failed   # only if it fails
```

CI signs, exports, verifies, and uploads the `.ipa` to TestFlight automatically (default
`upload: true`). No Xcode Organizer, no Transporter, no local Mac.

Then in the browser:

1. Open https://appstoreconnect.apple.com/.
2. **My Apps → your app → TestFlight → Builds** → the CI build appears there.
3. **App Store → Add Build → select the CI build → submit for review**.

Inviting TestFlight testers is optional — you can submit the CI build directly to App Store review.

## 4. TestFlight: skip or not?

TestFlight is the **upload pipe**, not a testing requirement:

- `upload: true` (default): CI pushes the `.ipa` to TestFlight; the build appears in App Store Connect → TestFlight → Builds, and you submit it for review from the browser.
- You do **not** need to invite internal or external testers to submit for review. Direct App Store review submission is done entirely in the browser.

## 5. What breaks if you skip TestFlight (`upload=false`)

CI skips the TestFlight upload and leaves the `.ipa` only as:
- a GitHub Actions artifact (`faazio-<app>-<version>-ipa`), and
- a GitHub Release attachment (via `gh release upload --clobber`).

From Linux there is **no official tool** to push an `.ipa` into App Store Connect — Xcode and
Transporter are Mac-only. So with `upload: false` and no Mac, the binary is effectively stuck in
GitHub and cannot reach App Store Connect. Leave `upload` true unless you have a Mac available to
handle the `.ipa` manually.

## 6. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `restore-ios-signing.sh` fails | `APPSTORE_CERTIFICATE_BASE64`, `APPSTORE_CERTIFICATE_PASSWORD`, `APPSTORE_TEAM_ID`, or `APPSTORE_PROVISIONING_PROFILE_<APP>` missing/wrong | `gh secret list`; confirm profile is an **App Store** profile for that product's bundle id |
| Archive/export signing error | Profile bundle id doesn't match built config; `APPSTORE_TEAM_ID` doesn't own the cert/profile | Confirm bundle id (`com.faazio.customer` / `com.faazio.deliverypartner` / `com.faazio.sellerpartner`) and team ownership |
| TestFlight upload fails | `APPSTORE_ISSUER_ID`/`APPSTORE_API_KEY_ID` (variables) or `APPSTORE_API_PRIVATE_KEY` (secret) wrong; API key lacks App Manager role | Verify secrets; confirm the `.p8` key has the App Manager role |
| Build not appearing in TestFlight | App Store Connect rejects a build number that is not higher than the last upload. The workflow generates a UTC-timestamp build number (`YYYYMMDDHHmm`) on every run | Re-run the workflow so it produces a higher `CURRENT_PROJECT_VERSION`; bump `-f version` only when you intend a new App Store version |
| `.ipa` stuck with `upload: false` | No official Linux tool to push to App Store Connect | Obtain a Mac to handle the binary, or re-run with `upload: true` |

For workflow errors, `gh run view --log-failed <run-id>` surfaces the xcodebuild / signing error.