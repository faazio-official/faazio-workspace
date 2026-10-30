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
> launcher icon from `src/delivery/res/` / `src/seller/res/` (iOS: `Delivery-AppIcon` /
> `Seller-AppIcon` in `ios/Faazio/Images.xcassets/`). Their Firebase `google-services.json` files
> are CI-only (`GOOGLE_SERVICES_DELIVERY_JSON` / `GOOGLE_SERVICES_SELLER_JSON`).

---

## Step 2: Signing

The release build reads `keystore/keystore.properties` (gitignored). Start from the committed
template:

```bash
cp keystore.properties.example keystore/keystore.properties && chmod 600 keystore/keystore.properties
```

```properties
STORE_FILE=../../keystore/faazio-release.keystore
KEYSTORE_PASS=...
KEY_ALIAS=...
ALIAS_PASS=...
```
> The key names must be `KEYSTORE_PASS` / `ALIAS_PASS` (not `STORE_PASSWORD` / `KEY_PASSWORD`) —
> they are what `scripts/restore-keystore.sh` writes and `android/app/build.gradle` reads.

- **CI:** `.github/workflows/release-apk.yml` restores the keystore from `KEYSTORE_BASE64` +
  password secrets via `scripts/restore-keystore.sh`.
- **Manual:** run the same script with those env vars present.
- A release build fails fast if the keystore/properties are missing — it never falls back to the
  debug key.
- **Back up the keystore.** Losing it means you can never update the app on Play.

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
2. **App signing** (Setup → **App signing**): Play App Signing is mandatory for new apps. Your
   release keystore becomes the **upload key**. Export its public certificate and upload it —
   `keytool -exportcert -rfc -keystore keystore/faazio-release.keystore -alias faazio -file /tmp/faazio_upload_key.pem`
   (public cert only; safe to send to Play). Confirm the **upload-key SHA-256** shown matches
   `23:8A:02:B2:0F:64:E6:EB:8A:33:17:39:75:A9:AE:C7:DD:66:CC:72:83:E1:0B:3B:EF:F4:70:01:4E:E4:09:9D`.
   Google then manages the **app signing key**; CI keeps signing every AAB with the same release
   keystore (upload key) so uploads are always accepted.
3. **App content / Data safety** (App content → Data safety): disclose **camera, location (rough +
   precise), media/photos, and Keychain/Keystore token storage**. Also complete content rating,
   target audience, and a Privacy Policy URL before a production rollout. Use the answer sheet in
   **Step 3c** below.
4. **Internal testing first** (Testing → Internal testing): upload the workflow's `.aab`, add your
   tester email, roll out. Installing via the internal link also makes **Play Integrity** return
   valid (it checks the Play Store app record against the Firebase SHA-256) — the prerequisite for
   turning on **App Check → Play Integrity → Enforce** and for SMS auto-retrieval on the signed build.
5. After internal smoke tests pass, repeat the upload in **Closed testing**, then **Production**.

## Step 3c: Data Safety / App Content answer sheet (per listing)

Record the answers here so each listing is submitted consistently. The app has no advertising SDK
and no `AD_ID` permission.

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
- [ ] Release built in CI with the release keystore and `CERT_PINS` configured.
- [ ] Release keystore SHA-1/SHA-256 registered in Firebase for all three apps; Maps/Places keys restricted to the release SHA-1.
- [ ] R8 smoke test passed on a device: Home → Cart → Checkout → Pharma.
- [ ] Data Safety answer sheet (Step 3c) applied to every listing: 18+, minors restricted, delete-account URL `https://faazio.com/privacy`, delete-without-account = Yes, advertising ID = No.
- [ ] Data Safety discloses camera, location, media, and Keychain/Keystore token storage.
- [ ] In-app **Delete account** works (`Account → Privacy and security`) and clears the session; the public `#delete-account` section loads.
- [ ] AAB produced by the workflow with `-f include-aab=true` (`bundleCustomerRelease` / `bundleDeliveryRelease` / `bundleSellerRelease`) and uploaded to Play Console.

## See also

- `docs/RUNBOOKS/RELEASE.md` — signing, CI release flow, R8, smoke tests.
- `docs/RUNBOOKS/CI_PIPELINE.md` — workflow triggers and artifacts.
