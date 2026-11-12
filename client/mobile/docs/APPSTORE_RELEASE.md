# Apple App Store Release Manual

This document covers compiling, signing, and uploading the **Faazio** iOS app to App Store Connect.
The project is a **bare React Native 0.86.3** app: `ios/` is committed, CocoaPods is the dependency
manager, and there is no prebuild/EAS step.

> **Codemagic builds, signs and uploads the `.ipa`.** Start the **iOS Customer Release** workflow in
> Codemagic (see `docs/RUNBOOKS/CI_PIPELINE.md` → "🍎 iOS release" and
> `docs/RUNBOOKS/IOS_RELEASE_WITHOUT_MACOS.md`). The GitHub `ios-release.yml` workflow is disabled.
> The Xcode steps below remain the manual fallback when no CI run is wanted.

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

## Codemagic Release (Linux Developer Path)

If you develop on Linux and have no Mac, use Codemagic for the build/sign/upload and the browser for
App Store Connect submission. No Xcode is required on your machine.

**Step 0: Confirm the Codemagic variable group `ios app` is set.**

| Variable | Where it comes from |
|---|---|
| `APPSTORE_CERTIFICATE_BASE64` | base64 of your shared Apple Distribution `.p12` (exported from Keychain on a Mac) |
| `APPSTORE_CERTIFICATE_PASSWORD` | the `.p12` password |
| `APPSTORE_PROVISIONING_PROFILE_CUSTOMER` | base64 of the App Store `.mobileprovision` for `com.faazio.customer` (must include Push Notifications) |
| `APPSTORE_API_PRIVATE_KEY` | contents of the App Store Connect `AuthKey_*.p8` key |
| `APPSTORE_TEAM_ID` | your 10-char Apple Developer Team ID |
| `APPSTORE_ISSUER_ID` | App Store Connect API issuer ID |
| `APPSTORE_API_KEY_ID` | App Store Connect API key ID |
| `CERT_PINS` | comma-separated base64 SHA-256 SPKI pins (from `scripts/cert-pins.sh`) |
| `GOOGLE_MAPS_API_KEY_IOS` | restricted iOS Maps key |
| `GOOGLE_PLACES_API_KEY` | Places API (New) key |

The gateway/portal origins, `USE_GATEWAY`, `STRICT` and `USE_FIREBASE_AUTH` are set in
`codemagic.yaml`. See `docs/RUNBOOKS/CI_PIPELINE.md` → "iOS / App Store" for the full table.

The upload step materialises `APPSTORE_API_PRIVATE_KEY` with
`client/mobile/scripts/ios-appstore-key.sh`, which repairs literal `\n`, quotes, CRLF, paths and
base64 before calling `app-store-connect publish`, so a paste-style value no longer fails with
"not a valid PEM encoded private key".

**Step 1: Start the build.**

In Codemagic, open the Faazio application → **Start new build** → branch `main` → workflow
**iOS Customer Release**. Optionally enter `version` (blank uses `package.json`) and start.

**Step 2: Wait for Codemagic.**

Codemagic signs, exports, verifies, and uploads the `.ipa` to App Store Connect automatically. You
do not open Xcode Organizer or Transporter. The IPA is also kept as a Codemagic artifact.

**Step 3: Open App Store Connect.**

Open https://appstoreconnect.apple.com/ in a browser and sign in with your Apple Developer account.

**Step 4: Select the build in TestFlight.**

Go to **My Apps → your app → TestFlight → Builds**. The build appears there once processing
finishes. Select it.

**Step 5: Submit for review.**

Go to **App Store → Add Build → select the build → submit for review**. Inviting TestFlight
testers is optional — you can submit the build directly to App Store review without inviting
testers.

**Metadata checklist (complete in the browser):**

- App description and keywords
- Support URL and privacy policy URL (`https://faazio.com/privacy`)
- Screenshots for each device size
- App Privacy questionnaire (data collected, linked to identity, tracking) — use the exact
  selections in [§5a](#5a-app-privacy-questionnaire--exact-selections)

> **Note:** `codemagic.yaml` always uploads on a successful build; beta review and App Store
> submission stay manual. The GitHub `ios-release.yml` `upload` input no longer applies. See
> `docs/RUNBOOKS/IOS_RELEASE_WITHOUT_MACOS.md` for the full no-Mac runbook.

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

Codemagic already uploads the signed `.ipa` to App Store Connect automatically; you do **not** open
Xcode Organizer or manually upload a build.

1. In [App Store Connect](https://appstoreconnect.apple.com/), open the app → **TestFlight → Builds**.
2. Select the Codemagic build once processing finishes.
3. Complete store metadata: description, keywords, support URL, screenshots, privacy policy URL.
4. Answer the **App Privacy** questionnaire (data collected, linked to identity, tracking).
5. Go to **App Store → Add Build → select the build → submit for review**.

Inviting TestFlight testers is optional — you can submit the build directly to App Store review
without adding testers.

### 5a. App Privacy Questionnaire — Exact Selections

This table is the **source of truth** for both App Store Connect and
`ios/Faazio/PrivacyInfo.xcprivacy`. Keep the two in sync — the manifest is what Xcode/Apple read
at build/review time, and a mismatch against App Store Connect is a rejection risk.

In **App Store Connect → My Apps → Faazio → App Privacy → Get Started**:

| Step | Selection |
|------|-----------|
| Do you collect data? | **Yes** |
| Privacy Policy URL | `https://faazio.com/privacy` (must be live/public) |

For each data type below, click **Add** → choose the category → set Linked / Tracking / Purposes
exactly as listed, then click **Publish**.

| Apple category | Data type | Linked to identity | Tracking | Purposes |
|----------------|-----------|--------------------|----------|----------|
| Contact Info | Name | Yes | No | App Functionality, Product Personalization |
| Contact Info | Email Address | Yes | No | App Functionality |
| Contact Info | Phone Number | Yes | No | App Functionality |
| Contact Info | Physical Address | Yes | No | App Functionality, Product Personalization |
| Health & Fitness | Health | Yes | No | App Functionality |
| Financial Info | Payment Info | Yes | No | App Functionality |
| Location | Precise Location | Yes | No | App Functionality, Product Personalization |
| User Content | Photos or Videos | Yes | No | App Functionality |
| User Content | Other User Content | Yes | No | App Functionality, Product Personalization |
| Search History | Search History | No | No | App Functionality, Product Personalization |
| Identifiers | User ID | Yes | No | App Functionality |
| Identifiers | Device ID | Yes | No | App Functionality |
| Purchases | Purchase History | Yes | No | App Functionality, Product Personalization |
| Usage Data | Product Interaction | Yes | No | Analytics, Product Personalization |
| Usage Data | Advertising Data | Yes | No | App Functionality, Analytics |
| Usage Data | Other Usage Data | Yes | No | Analytics |
| Diagnostics | Crash Data | No | No | App Functionality |
| Diagnostics | Other Diagnostic Data | No | No | App Functionality |
| Other | Other Data Types | Yes | No | App Functionality |

**Tracking: No** overall — no ad SDKs, no data brokers, no third-party advertising. Leave "Uses
data to track" and `NSPrivacyTracking` as `false`.

> **Keep the manifest in sync.** The same 19 entries live in
> `ios/Faazio/PrivacyInfo.xcprivacy` (`NSPrivacyCollectedDataTypes`). Before submitting, verify in
> Xcode with **Product → Archive** then (control-click the archive) **Generate Privacy Report** —
> all 19 categories should appear and tracking must be off.

> **English (U.K.) keywords:** App Store Connect requires a completed English (U.K.) localisation
> (keywords, and subtitles/description where prompted) before the **Add for Review** button
> unlocks. Fill it under the app version's **App Store** tab → **English (U.K.)**.

> **Why these answers:**
> - **Name / Email Address / Phone Number / Physical Address / Payment Info / Other Data Types** —
>   the "Sell with us" seller-onboarding flow (reachable from **Account → Sell with us**) collects
>   business + owner name, contact email, PAN/GSTIN (government/business identifiers → *Other Data
>   Types*) and bank account number + IFSC + beneficiary (→ *Payment Info*). Phone Number is also
>   the Firebase Phone Auth login identifier; the delivery address book stores name + physical
>   address.
> - **Health** — prescription images and prescription notes (`pharma.prescriptions`).
> - **Precise Location** — nearby-store discovery, delivery-fee estimate and address auto-fill
>   (Google Places + the native geocoder).
> - **Photos or Videos** — prescription camera captures and seller KYC document images (stored as
>   object keys in private storage, never public URLs).
> - **Other User Content** — product reviews, vendor ratings and post-order feedback comments.
> - **Search History** — device-local `AsyncStorage` (`faazio:recentSearches`) **only**; never sent
>   to the server and not keyed to any account, hence *Not Linked*.
> - **User ID** — Firebase `sub`/uid that binds server writes to the account.
> - **Device ID** — FCM push token registered via `POST /notifications/register` and stored in
>   `notifications.push_tokens` keyed by `user_id`.
> - **Purchase History** — the account's order history.
> - **Product Interaction / Other Usage Data** — `view`/`cart_add`/`order`/`search` events stored
>   in MongoDB `faazio.user_events` with a SHA-256-hashed user id (`userIdHash`, 90-day TTL) and
>   used to feed `GET /recommendations` and analytics.
> - **Advertising Data** — first-party sponsored-slot impression/click events (`POST /ads/events`)
>   for in-app attribution; not used for tracking.
> - **Crash Data / Other Diagnostic Data** — PII-free crash and error reports to `POST /errors`
>   (message + stack + app/OS version; no user or device id attached).

> **Note:** `codemagic.yaml` always uploads on a successful build; beta review and App Store
> submission stay manual.

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
