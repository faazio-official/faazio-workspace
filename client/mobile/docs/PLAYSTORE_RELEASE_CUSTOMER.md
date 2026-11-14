# Google Play Store Release Manual

This document covers compiling, signing, and uploading the **Faazio** Android app to Google Play.
The project is a **bare React Native 0.86.3** app: `android/` is committed and there is no
prebuild/EAS step.

---

## Prerequisites

1. **Google Play Developer Account** (one-time registration fee).
2. **Release keystore** — stored only as GitHub secrets; see `docs/RUNBOOKS/RELEASE.md`.
3. **CI-only builds** — never run Gradle locally on this host (systemd-oomd OOM-kills it).

---

## Step 1: Android configuration

Android metadata lives in the committed native project, not `app.json` (deleted):

| Setting | File |
|---|---|
| `applicationId` / `namespace` | `android/app/build.gradle` (`com.faazio.customer`) |
| `versionCode` / `versionName` | `android/app/build.gradle` (keep `package.json` version in sync) |
| Permissions | `android/app/src/main/AndroidManifest.xml` |
| Icons | customer `android/app/src/main/res/`; delivery/seller `android/app/src/<flavor>/res/` (splash stays in `src/main/res/`) |
| Cleartext / cert pins | `android/app/src/main/res/xml/network_security_config.xml` |
| Min/target/compile SDK | `android/build.gradle` (`24/36/36`) |

> **CRITICAL:** `com.faazio.customer` must remain globally unique and unchanged — changing it creates
> a new Play listing and breaks updates.

> The partner apps are separate Play listings built from the same shell with their own `applicationId`
> and launcher label: Delivery Partner `com.faazio.deliverypartner` ("Faazio Delivery Partner"),
> Seller Partner `com.faazio.sellerpartner` ("Faazio Seller Partner"). Each also ships its own
> launcher icon from `src/delivery/res/` / `src/seller/res/`. Their Firebase `google-services.json`
> files are CI-only (`GOOGLE_SERVICES_DELIVERY_JSON` / `GOOGLE_SERVICES_SELLER_JSON`). The partner
> apps are Android/Play only — they have no iOS target or App Store release.

---

## Step 2: Signing

**Each product signs with its OWN release keystore.** The build reads the matching properties file
(gitignored):

| App | Properties file | Keystore | Alias |
|---|---|---|---|
| customer | `keystore/keystore.properties` | `faazio-release.keystore` (**purged 2026-11-06 — re-provision**) | `faazio` |
| delivery | `keystore/keystore-delivery.properties` | `faazio-delivery-release.keystore` | `faazio-delivery` |
| seller | `keystore/keystore-seller.properties` | `faazio-seller-release.keystore` | `faazio-seller` |

Start from the committed template (`keystore.properties.example`) for the app you're building:

```bash
cp keystore.properties.example keystore/keystore-seller.properties && chmod 600 keystore/keystore-seller.properties
```

```properties
STORE_FILE=../../keystore/faazio-seller-release.keystore
KEYSTORE_PASS=...
KEY_ALIAS=faazio-seller
ALIAS_PASS=...
```
> Key names must be `KEYSTORE_PASS` / `ALIAS_PASS` (not `STORE_PASSWORD` / `KEY_PASSWORD`) —
> `scripts/restore-keystore.sh <app>` writes them and `android/app/build.gradle` reads them.

- **CI:** `.github/workflows/release-apk.yml` restores the product's keystore from
  `KEYSTORE_BASE64_<APP>` + the matching password secrets via `scripts/restore-keystore.sh <app>`,
  then `apksigner verify`s the signed APK and pins that app's **upload-key** SHA-256 — a cross-app
  keystore mix fails the build. The **customer** branch is intentionally blocked until its purged
  upload key is re-provisioned (see Step 2 below).
- **Manual:** run the same script with `<app>` and those env vars present.
- A release build fails fast if that product's keystore/properties are missing — it never falls back
  to the debug key.
- **Back up the delivery and seller keystores securely.** Losing one means you can never update
  that app on Play. The customer key was purged on 2026-11-06 and must be re-provisioned, then
  backed up.

Signature schemes: release APKs are v2/v3-signed, correct for `minSdk 24`. v1 is not required.

---

## Step 3: Build the release artifact in CI

The release workflow always builds a signed **APK**; pass `-f include-aab=true` to also build and
attach a signed **AAB** (`.aab`). Both are attached to the GitHub Release
(`gh release upload --clobber`):

```bash
cd client/mobile
gh workflow run release-apk.yml -f version=1.1.0 -f tag=v1.1.0 -f include-aab=true
gh run watch
gh run view --log-failed          # on failure
```

Play requires an AAB — download the `faazio-<app>-<version>-aab` artifact (or grab `*.aab` from
the GitHub Release) and upload that. The local equivalent (CI-only, never run this host's Gradle):

```bash
cd android
./gradlew bundleCustomerRelease --no-daemon \
  -PreactNativeArchitectures="arm64-v8a" \
  -Pandroid.enableMinifyInReleaseBuilds=true \
  -Pandroid.enableShrinkResourcesInReleaseBuilds=true
# -> app/build/outputs/bundle/customerRelease/app-customer-release.aab
# delivery: bundleDeliveryRelease -> app-delivery-release.aab
# seller:   bundleSellerRelease   -> app-seller-release.aab
```

> Do **not** run this locally. When the workflow is dispatched with `-f include-aab=true` it
> publishes the AAB in CI; download it as an artifact (`faazio-<app>-<version|-release>-aab`) or
> from the GitHub Release.

---

## Step 3b: First-time Play Console setup (once per app)

Each product is a **separate Play listing**; run this for `com.faazio.customer` ("Faazio"),
`com.faazio.deliverypartner` ("Faazio Delivery Partner"), and `com.faazio.sellerpartner`
("Faazio Seller Partner").

1. **Create the app** (Play Console → **Create app**): name + default language; enter the exact
   `applicationId` as the Application ID; free/paid; declare ads.
2. **App signing** (**Protected with Play → Play Store protection → Manage Play app signing**):
   Play App Signing is mandatory for new apps. The customer upload key was **purged on
   2026-11-06**. Generate the new keystore first, export its public cert, then submit the reset —
   `keytool -exportcert -rfc -keystore keystore/faazio-release.keystore -alias faazio -file /tmp/faazio_upload_key.pem`
   (public cert only; safe to send to Play). In the **Upload key certificate** section click
   **Request upload key reset**, enter the reason, upload the PEM, and **Request**. Record the new
   upload-key SHA-256 in `docs/RUNBOOKS/SIGNING_FINGERPRINTS.md` §2. If the page shows
   **quantum-ready hybrid signing**, register all three app-signing fingerprints with Firebase/Maps.
   Google manages the **app signing key**; CI signs every AAB with the new upload key.
3. **App content / Data safety** (App content → Data safety): disclose **camera, location (rough +
   precise), media/photos, and Keychain/Keystore token storage**. Also complete content rating,
   target audience, and a Privacy Policy URL before a production rollout. Use the answer sheet in
   **Step 3c** below.
4. **Internal testing first** (Testing → Internal testing): upload the workflow's `.aab`, add your
   tester email, roll out. Installing via the internal link also makes **Play Integrity** return
   valid (it checks the Play Store app record against the Firebase SHA-256) — the prerequisite for
   turning on **App Check → Play Integrity → Enforce** and for SMS auto-retrieval on the signed build.
5. After internal smoke tests pass, repeat the upload in **Closed testing**, then **Production**.

## Step 3c: Data Safety / App Content answer sheet (customer listing)

Record the answers here so the **customer** listing is submitted consistently. The app has no
advertising SDK and no `AD_ID` permission. The **seller** listing uses a different set of answers —
see `PLAYSTORE_RELEASE_SELLER.md`.

| Section | Selection | Why |
|---|---|---|
| Target age groups | **18 and over only** | Pharma prescriptions + payments; policy says the service is for adults |
| Restrict minors | **Enabled** | Under-18 groups become unselectable |
| Account creation method | **Username and other authentication** | Phone number + Firebase OTP |
| Independent security review | **No** | No SOC 2 / ISO 27001 / third-party audit |
| UPI payments verified (NPCI) | **No** | Faazio launches third-party UPI apps; it is not a finance app |
| Delete account URL | `https://faazio.com/privacy` | Prominent “Delete your account” section (`#delete-account`) |
| Delete data without deleting account | **Yes** | In-app Account → Privacy and security → Request data deletion (`POST /users/me/data-deletion`) |
| Ephemeral processing | **No** for personal data | Data persists in Supabase / Keychain |
| Encrypted in transit | **Yes** | HTTPS release + certificate pinning; cleartext denied |
| Advertising ID | **No** | No ad SDK / `AD_ID` permission |
| Data collected / shared | **Yes** | Camera, location, media/photos, personal info, financial, health |
| Required vs optional | Phone/name/IDs **required**; location/photos/address **optional** | Phone+OTP is sole auth; manual fallbacks exist |
| Why collected | App functionality, account management, fraud prevention/security, personalisation | Derived from the app flows |
| Why shared | App functionality, account management, fraud prevention/security | Gateway, Firebase, Supabase, Razorpay, UPI apps |
| Financial features | **Mobile payments / digital wallets** + **Rewards, points, incentives** | UPI + tokenised cards; FaazioCoins / streak discounts |
| Health features | **Medication and treatment management** + **Healthcare services and management** | Prescription upload, pharma ordering, blood donation |

**Account deletion (required):** in-app **Account (You) → Privacy and security → Delete account**
calls `DELETE /users/me`. It erases profile/addresses/favourites/prescriptions/rewards/blood records,
unlinks the auth identity and clears the session, while retaining order/payment/tax records for
legal retention. Never ship a build with the row hidden or the route removed.

## Step 4: Upload to Play Console

1. Open [Google Play Console](https://play.google.com/console/) and select Faazio.
2. Go to **Testing → Internal/Closed testing** (or **Production**) → **Create new release**.
3. Upload `app-customer-release.aab` (or `app-delivery-release.aab` / `app-seller-release.aab`).
4. Fill in store listing, screenshots, content rating, and **Data Safety**.
5. Start rollout and submit for review.

---

## Checklist

- [ ] `versionCode` > previous release (auto-derived from `-f version=` semver, or +1 committed bump) and `versionName` matches `package.json`.
- [ ] `npm run ts:check` and `npm run check:boundaries` pass (both run in CI).
- [ ] Customer upload key re-provisioned (Play Console upload-key reset) and the four `_CUSTOMER`
  keystore secrets re-added; customer CI releases are intentionally blocked until then.
- [ ] Release built in CI with the release keystore and `CERT_PINS` configured.
- [ ] **Play App Signing** SHA-1/SHA-256 registered in Firebase for each Play-listed app; the
  **upload-key** SHA-1/SHA-256 registered for sideloaded/CI APKs (delivery/seller; customer after
  the reset); each app's **debug** cert registered. Maps/Places keys restricted to the Play App
  Signing SHA-1 (+ the new upload-key SHA-1) for **customer + delivery** (the seller app is a WebView
  shell with no native map).
- [ ] R8 smoke test passed on a device: Home → Cart → Checkout → Pharma.
- [ ] Data Safety answer sheet (Step 3c) applied to every listing: 18+, minors restricted, delete-account URL `https://faazio.com/privacy`, delete-without-account = Yes, advertising ID = No.
- [ ] Data Safety discloses camera, location, media, and Keychain/Keystore token storage.
- [ ] In-app **Delete account** works (`Account → Privacy and security`) and clears the session; the public `#delete-account` section loads.
- [ ] AAB produced by the workflow with `-f include-aab=true` (`bundleCustomerRelease` / `bundleDeliveryRelease` / `bundleSellerRelease`) and uploaded to Play Console.

## See also

- `PLAYSTORE_RELEASE_SELLER.md` — Play Console answer sheet for the seller listing
  (`com.faazio.sellerpartner`).
- `docs/RUNBOOKS/RELEASE.md` — signing, CI release flow, R8, smoke tests.
- `docs/RUNBOOKS/CI_PIPELINE.md` — workflow triggers and artifacts.
