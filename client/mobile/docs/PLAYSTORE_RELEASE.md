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
| Icons / splash | `android/app/src/main/res/` |
| Cleartext / cert pins | `android/app/src/main/res/xml/network_security_config.xml` |
| Min/target/compile SDK | `android/build.gradle` (`24/36/36`) |

> **CRITICAL:** `com.faazio.customer` must remain globally unique and unchanged — changing it creates
> a new Play listing and breaks updates.

> The partner apps are separate Play listings built from the same shell with their own `applicationId`
> and launcher label: Delivery Partner `com.faazio.deliverypartner` ("Faazio Delivery Partner"),
> Seller Partner `com.faazio.sellerpartner` ("Faazio Seller Partner"). Their Firebase
> `google-services.json` files are CI-only (`GOOGLE_SERVICES_DELIVERY_JSON` /
> `GOOGLE_SERVICES_SELLER_JSON`).

---

## Step 2: Signing

The release build reads `keystore/keystore.properties` (gitignored):

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

The release workflow builds **both** a signed **APK** and a signed **AAB** (`.aab`) and attaches
both to the GitHub Release (`gh release upload --clobber`):

```bash
cd client/mobile
gh workflow run release-apk.yml -f version=1.1.0 -f tag=v1.1.0
gh run watch
gh run view --log-failed          # on failure
```

Play requires an AAB — download the `faazio-<app>-<version>-aab` artifact (or grab `*.aab` from
the GitHub Release) and upload that. The local equivalent (CI-only, never run this host's Gradle):

```bash
cd android
./gradlew bundleCustomerRelease --no-daemon \
  -PreactNativeArchitectures="arm64-v8a,armeabi-v7a" \
  -Pandroid.enableMinifyInReleaseBuilds=true \
  -Pandroid.enableShrinkResourcesInReleaseBuilds=true
# -> app/build/outputs/bundle/customerRelease/app-customer-release.aab
# delivery: bundleDeliveryRelease -> app-delivery-release.aab
# seller:   bundleSellerRelease   -> app-seller-release.aab
```

> Do **not** run this locally. The workflow publishes the AAB in CI; download it as an
> artifact (`faazio-<app>-<version|-release>-aab`) or from the GitHub Release.

---

## Step 4: Upload to Play Console

1. Open [Google Play Console](https://play.google.com/console/) and select Faazio.
2. Go to **Testing → Closed testing** (or **Production**) → **Create new release**.
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
- [ ] Data Safety discloses camera, location, media, and Keychain/Keystore token storage.
- [ ] AAB produced by the workflow (`bundleCustomerRelease` / `bundleDeliveryRelease` / `bundleSellerRelease`) and uploaded to Play Console.

## See also

- `docs/RUNBOOKS/RELEASE.md` — signing, CI release flow, R8, smoke tests.
- `docs/RUNBOOKS/CI_PIPELINE.md` — workflow triggers and artifacts.
