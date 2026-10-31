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

The partner apps are **separate listings** built from the same target: Delivery Partner bundle id
`com.faazio.deliverypartner` (`Delivery-Release`, display name "Faazio Delivery Partner"), Seller
Partner bundle id `com.faazio.sellerpartner` (`Seller-Release`, display name "Faazio Seller Partner").
Each needs its own Firebase app's `GoogleService-Info-*.plist` (ops-supplied) and an App Store Connect
record.

---

## Step 1: iOS configuration

iOS metadata lives in the committed Xcode project, not `app.json` (deleted):

| Setting | File |
|---|---|
| Bundle identifier | `ios/Faazio.xcodeproj/project.pbxproj` (`com.faazio.customer`) |
| Version / build | Xcode target **General** tab (`MARKETING_VERSION` / `CURRENT_PROJECT_VERSION`) |
| Permission strings | Per-variant plists selected by `INFOPLIST_FILE`: `ios/Faazio/Info.plist` (customer — `NSCameraUsageDescription`, `NSLocationWhenInUseUsageDescription`), `Info-Delivery.plist` (delivery — camera, `NSLocationWhenInUseUsageDescription`, `NSLocationAlwaysAndWhenInUseUsageDescription`), `Info-Seller.plist` (seller — camera only) |
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

1. In [App Store Connect](https://appstoreconnect.apple.com/), open the app → **TestFlight**.
2. Add internal/external testers once the build finishes processing.
3. Complete store metadata: description, keywords, support URL, screenshots, privacy policy URL.
4. Answer the **App Privacy** questionnaire (data collected, linked to identity, tracking).
5. Select the build under **App Store → Add Build** and submit for review.

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
