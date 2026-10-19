# Google Play Store Release Manual

This document covers compiling, signing, and uploading the **Faazio** Android app to Google Play.
The project is a **bare React Native 0.86.3** app: `android/` is committed and there is no Expo
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

---

## Step 2: Signing

The release build reads `keystore/keystore.properties` (gitignored):

```properties
STORE_FILE=../../keystore/faazio-release.keystore
STORE_PASSWORD=...
KEY_ALIAS=...
KEY_PASSWORD=...
```

- **CI:** `.github/workflows/release-apk.yml` restores the keystore from `KEYSTORE_BASE64` +
  password secrets via `scripts/restore-keystore.sh`.
- **Manual:** run the same script with those env vars present.
- A release build fails fast if the keystore/properties are missing — it never falls back to the
  debug key.
- **Back up the keystore.** Losing it means you can never update the app on Play.

Signature schemes: release APKs are v2/v3-signed, correct for `minSdk 24`. v1 is not required.

---

## Step 3: Build the release artifact in CI

The current release workflow publishes a signed **APK** (GitHub Release):

```bash
cd client/mobile
gh workflow run release-apk.yml -f version=1.1.0 -f tag=v1.1.0
gh run watch
gh run view --log-failed          # on failure
```

Play requires an **AAB**. The workflow does not publish one yet; add a `bundleRelease` step/job
(the Gradle command is identical to `assembleRelease`):

```bash
cd android
./gradlew bundleRelease --no-daemon \
  -PreactNativeArchitectures="arm64-v8a,armeabi-v7a" \
  -Pandroid.enableMinifyInReleaseBuilds=true \
  -Pandroid.enableShrinkResourcesInReleaseBuilds=true
# -> app/build/outputs/bundle/release/app-release.aab
```

> Do **not** run this locally. Add it to the GitHub Actions workflow (or a separate CI job) and
> download the artifact from the run.

---

## Step 4: Upload to Play Console

1. Open [Google Play Console](https://play.google.com/console/) and select Faazio.
2. Go to **Testing → Closed testing** (or **Production**) → **Create new release**.
3. Upload `app-release.aab`.
4. Fill in store listing, screenshots, content rating, and **Data Safety**.
5. Start rollout and submit for review.

---

## Checklist

- [ ] `versionCode` bumped (+1) and `versionName` matches `package.json`.
- [ ] `npm run ts:check` and `npm run check:boundaries` pass.
- [ ] Release built in CI with the release keystore and `CERT_PINS` configured.
- [ ] R8 smoke test passed on a device: Home → Cart → Checkout → Pharma.
- [ ] Data Safety discloses camera, location, media, and Keychain/Keystore token storage.
- [ ] AAB produced in CI (add the `bundleRelease` job if not present).

## See also

- `docs/RUNBOOKS/RELEASE.md` — signing, CI release flow, R8, smoke tests.
- `docs/RUNBOOKS/CI_PIPELINE.md` — workflow triggers and artifacts.
