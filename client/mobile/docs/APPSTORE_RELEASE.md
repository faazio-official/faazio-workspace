# Apple App Store Release Manual

This document covers compiling, signing, and uploading the **Faazio** iOS app to App Store Connect.
The project is a **bare React Native 0.86.3** app: `ios/` is committed, CocoaPods is the dependency
manager, and there is no prebuild/EAS step.

> **CI can build, sign and upload the `.ipa` now.** Prefer
> `gh workflow run ios-release.yml -f app=customer` (see `docs/RUNBOOKS/CI_PIPELINE.md` →
> "🍎 iOS release" and `docs/RUNBOOKS/RELEASE.md` → "App Store (iOS)"). The Xcode steps below remain
> the manual fallback when no CI run is wanted.

---

## Prerequisites

1. **Apple Developer Program** membership.
2. **macOS + Xcode** (iOS builds cannot be produced on the Linux CI host).
3. CocoaPods (`gem install cocoapods` or Bundler).
4. An App Store Connect app record for `com.faazio.customer`.

The **customer app** (`com.faazio.customer`) is the only App Store listing. The partner apps are
**Google Play (Android) only** — the Delivery Partner (`com.faazio.deliverypartner`, `Delivery-*`)
and Seller Partner (`com.faazio.sellerpartner`, `Seller-*`) configurations exist in the committed
iOS shell for local/dev completeness but have **no planned iOS build or App Store release** and need
no iOS Firebase plist.

---

## CI-First Release (Linux Developer Path)

If you develop on Linux and have no Mac, use GitHub Actions for the build/sign/upload and the
browser for App Store Connect submission. No Xcode is required on your machine.

**Step 0: Confirm GitHub repo secrets are set.**

| Secret | Where it comes from |
|---|---|
| `APPSTORE_CERTIFICATE_BASE64` | base64 of your shared Apple Distribution `.p12` (exported from Keychain on a Mac) |
| `APPSTORE_CERTIFICATE_PASSWORD` | the `.p12` password |
| `APPSTORE_PROVISIONING_PROFILE_CUSTOMER` | base64 of the App Store `.mobileprovision` for `com.faazio.customer` (must include Push Notifications) |
| `APPSTORE_API_PRIVATE_KEY` | contents of the App Store Connect `AuthKey_*.p8` key |
| `APPSTORE_TEAM_ID` | your 10-char Apple Developer Team ID |
| `APPSTORE_ISSUER_ID` | App Store Connect API issuer ID |
| `APPSTORE_API_KEY_ID` | App Store Connect API key ID |
| `CERT_PINS` | comma-separated base64 SHA-256 SPKI pins (from `scripts/cert-pins.sh`) |

Verify with `gh secret list` in the repo.

**Step 1: Trigger the workflow.**

```bash
cd client/mobile
gh workflow run ios-release.yml -f app=customer -f version=1.0.6 -f tag=v1.0.6
# or: gh workflow run ios-release.yml -f app=delivery -f version=1.0.6 -f tag=v1.0.6-delivery
# or: gh workflow run ios-release.yml -f app=seller -f version=1.0.6 -f tag=v1.0.6-seller
```

**Step 2: Wait for CI.**

Run `gh run watch`. CI signs, exports, verifies, and uploads the `.ipa` to TestFlight automatically
(via `apple-actions/upload-testflight-build@v5`) unless you passed `-f upload=false`. You do not
open Xcode Organizer or Transporter.

**Step 3: Open App Store Connect.**

Open https://appstoreconnect.apple.com/ in a browser and sign in with your Apple Developer account.

**Step 4: Select the build in TestFlight.**

Go to **My Apps → your app → TestFlight → Builds**. The CI build appears there once processing
finishes. Select it.

**Step 5: Submit for review.**

Go to **App Store → Add Build → select the CI build → submit for review**. Inviting TestFlight
testers is optional — you can submit the CI build directly to App Store review without inviting
testers.

**Metadata checklist (complete in the browser):**

- App description and keywords
- Support URL and privacy policy URL (`https://faazio.com/privacy`)
- Screenshots for each device size
- App Privacy questionnaire (data collected, linked to identity, tracking)

> **Note on `upload=false`:** Skipping TestFlight traps the `.ipa` in the GitHub Actions artifact and
> GitHub Release attachment. From Linux there is no official tool to push an `.ipa` into App Store
> Connect (Xcode/Transporter are Mac-only), so leave `upload` true unless you have a Mac to handle
> the binary manually. See `docs/RUNBOOKS/IOS_RELEASE_WITHOUT_MACOS.md` for the full no-Mac runbook.

## Step 1: iOS configuration

iOS metadata lives in the committed Xcode project, not `app.json` (deleted):

| Setting | File |
|---|---|
| Bundle identifier | `ios/Faazio.xcodeproj/project.pbxproj` (`com.faazio.customer`) |
| Version / build | Xcode target **General** tab (`MARKETING_VERSION` / `CURRENT_PROJECT_VERSION`) |
| Permission strings | Per-variant plists selected by `INFOPLIST_FILE`: `ios/Faazio/Info.plist` (customer — `NSCameraUsageDescription`, `NSLocationWhenInUseUsageDescription`, `NSLocationAlwaysAndWhenInUseUsageDescription`), `Info-Delivery.plist` (delivery — camera, `NSLocationWhenInUseUsageDescription`, `NSLocationAlwaysAndWhenInUseUsageDescription`), `Info-Seller.plist` (seller — camera only) |
| App display name | `ios/Faazio/Info*.plist` (`CFBundleDisplayName` = `$(FAAZIO_APP_NAME)`) |
| Native geocoder | local pod `ios/FaazioGeocoder` |

> Apple rejects vague permission strings. Keep each description specific to the feature that
> triggers it (prescription capture + seller document capture, live address auto-fill). Do not
> declare a usage string for an API the app never calls — unused/generic strings (e.g. Face ID,
> motion, photo library) were removed.

---

## Step 2: Install pods and open the workspace

```bash
cd client/mobile
npm install
cd ios
pod install
open Faazio.xcworkspace
```

Use the **workspace**, not `.xcodeproj`, so CocoaPods targets are linked.

---

## Step 3: Configure signing

1. Select the **Faazio** target → **Signing & Capabilities**.
2. Choose your Apple Developer Team.
3. Let Xcode manage signing, or select your **Distribution Certificate** +
   **App Store Provisioning Profile**.
4. Confirm the bundle identifier matches the App Store Connect record.
5. Confirm the profile has the **Push Notifications** capability: the `*Release` configs sign with
   `ios/Faazio/Faazio.entitlements` (`aps-environment = production`) and the `*Debug` configs with
   `Faazio-Debug.entitlements` (`development`). A profile without Push fails with an
   entitlements/profile mismatch.

Signing credentials are managed locally in Xcode; they are not stored in this repo.

---

## Step 4: Build and archive

1. Set the run destination to **Any iOS Device (arm64)**.
2. **Product → Scheme → Edit Scheme → Run → Build Configuration = Release**.
3. **Product → Archive**.
4. In the Organizer, choose **Distribute App → App Store Connect → Upload**.

For a quick debug run in the simulator, `npm run ios` builds the debug app and starts Metro.

---

## Step 5: TestFlight and App Store review

CI already uploads the signed `.ipa` to TestFlight automatically (via `apple-actions/upload-testflight-build@v5`); you do **not** open Xcode Organizer or manually upload a build.

1. In [App Store Connect](https://appstoreconnect.apple.com/), open the app → **TestFlight → Builds**.
2. Select the CI build once processing finishes.
3. Complete store metadata: description, keywords, support URL, screenshots, privacy policy URL.
4. Answer the **App Privacy** questionnaire (data collected, linked to identity, tracking).
5. Go to **App Store → Add Build → select the CI build → submit for review**.

Inviting TestFlight testers is optional — you can submit the CI build directly to App Store review
without adding testers.

> **Note on `upload=false`:** Skipping TestFlight traps the `.ipa` in the GitHub Actions artifact and
> GitHub Release attachment. From Linux there is no official tool to push an `.ipa` into App Store
> Connect (Xcode/Transporter are Mac-only), so leave `upload` true unless you have a Mac to handle
> the binary manually.

---

## Guidelines and warnings

- **Privacy (5.1.1):** pharmaceutical/payment flows require a public Privacy Policy URL.
- **In-App Purchases (3.1.1):** physical goods and pharmacy items are exempt from IAP; use your
  normal payment gateway.
- **Completeness (2.1):** no placeholder screens or dead navigation paths in the submitted build.
  The Account nav catalog renders only rows with a real destination (the former Payments /
  Customer Support groups and Recently Viewed row were removed), and no "Coming soon" chrome
  remains.
- **Prescription data:** never upload real prescription images or PII in review builds/test data.

## See also

- `docs/RUNBOOKS/RELEASE.md` — signing, CI APK flow, and release checklist.
- `docs/architecture/mobile-app.md` — app architecture and feature map.
