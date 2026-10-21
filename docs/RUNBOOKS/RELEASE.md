# Release Runbook

> Build, sign, and ship the Faazio mobile app.

> **Prefer `docs/RUNBOOKS/CI_PIPELINE.md`** for the CI-based build/release flow (gh CLI + GitHub
> Actions). This runbook covers the manual/local steps and store upload as fallback.

## 🔑 Signing credentials

- Debug builds use the generated debug keystore (automatic).
- **Release builds are signed with the release keystore in CI** via
  `.github/workflows/release-apk.yml`. The committed `android/` project reads
  `keystore/keystore.properties`; the workflow runs `scripts/restore-keystore.sh` (decodes the
  keystore + writes `keystore.properties` from GitHub secrets) before `./gradlew assembleRelease`.
  A release build without that file fails fast with a clear Gradle error.
- The keystore file lives at `client/mobile/keystore/faazio-release.keystore` (gitignored).
  **Back it up securely — losing it means you can never update the app on the store.**
- **Release signing must use the release keystore, not the debug keystore.** A debug-signed
  build (`CN=Android Debug`) differs from the release cert (`CN=Faazio`); a user who installed
  one can no longer update — Android reports a signature conflict as
  **"App not installed as package appears to be invalid."** `android/app/build.gradle` wires the
  `release` buildType to the release keystore and never falls back to the debug key.
- **Signature schemes:** release APKs are signed with **v2 (APK Signature Scheme) only** (plus v3),
  which is correct for `minSdkVersion 24` (Android 7.0+). v1 (JAR) signing is intentionally omitted
  by both AGP and `apksigner` when minSdk ≥ 24 and is not required for install on Android 7.0+.

> Never commit `keystore.properties` or the `.keystore` file. Both are gitignored.
> `android/` and `ios/` are committed source-of-truth shells; CI does **not** regenerate them.

### GitHub secrets (set once)

The release keystore + signing properties are stored as GitHub repository secrets
(`gh secret set <NAME>`); they are never committed:

| Secret | Value |
|---|---|
| `KEYSTORE_BASE64` | `base64 client/mobile/keystore/faazio-release.keystore` |
| `KEYSTORE_PASS` | value from `keystore.properties` |
| `KEY_ALIAS` | value from `keystore.properties` |
| `ALIAS_PASS` | value from `keystore.properties` |
| `STORE_FILE` | (optional) keystore file name, default `faazio-release.keystore` |
| `GATEWAY_URL` | deployed gateway origin, `https://…` (release refuses `http://`); defaults to `https://faazio-workspace.onrender.com` |
| `USE_GATEWAY` | `true` to embed the live gateway (defaults to `true` in the workflow) |
| `CERT_PINS` | comma-separated base64 SHA-256 SPKI pins for the gateway host |
| `GOOGLE_MAPS_API_KEY_ANDROID` | restricted Maps SDK key; `configure.js` writes the manifest string resource (empty ⇒ blank shop-pin map) |
| `GOOGLE_PLACES_API_KEY` | restricted Places API (New) key for address autocomplete (empty ⇒ static suggestions) |
| `USE_FIREBASE_AUTH` | `true` (default) — phone OTP via the committed native Firebase config |

`configure.js` **fails the release** when `USE_GATEWAY=true` and `CERT_PINS` is missing, or when
`USE_FIREBASE_AUTH=false`, or when `android/app/google-services.json` /
`ios/Faazio/GoogleService-Info.plist` is absent — a release must never embed a mock-login or
unpinned build. The Firebase files are **public client config** (not secrets) and are committed so
CI can build; see `docs/RUNBOOKS/FIREBASE_AUTH.md`.

### Certificate-pin rotation

Render issues its TLS cert via Let's Encrypt (≈90-day lifetime). Keep **two** pins live during a
rotation so an in-flight app never fails closed:
1. Add the new pin alongside the current one in `CERT_PINS` (and in the CI secret) — 2-pin overlap.
2. Ship a release with both pins; wait for adoption.
3. ≥30 days before the current cert expires, cut over to the new pin only (search the old expiry and
   schedule the removal).

If Render's cert changes before a pinned release is updated, clients fail closed (intended) — the
network-security-config is what blocks a MITM even with a valid CA.

## 🚀 Release a new APK (GitHub Actions + gh CLI)

Release builds are **not** run on a local machine — they build and publish in GitHub Actions,
triggered with the `gh` CLI.

```bash
cd client/mobile
# 1) Bump the version (or pass it to the workflow)
#    edit package.json -> version, e.g. "1.1.0"

# 2) Trigger the CI build + release
gh workflow run release-apk.yml -f version=1.0.2 -f tag=v1.0.2

# 3) Watch it finish
gh run watch

# 4) The signed APK is attached to the GitHub Release v1.0.2
#    (gh release upload --clobber replaces any previous APK on that tag).
```

The workflow: checkout → setup Node 24 + JDK 21 → `gradle/actions/setup-gradle` (caches
`~/.gradle` + build cache) → **CI Gradle tuning** (overrides laptop memory caps via
`~/.gradle/gradle.properties`) → `npm ci` → `npm run configure` (release cert pins + JS config) →
`restore-keystore.sh` → `npm run ts:check` → `./gradlew assembleRelease` with **ABI + R8 minify flags**
(see below) → upload APK artifact → upload **R8 `mapping.txt` (private artifact)** →
`gh release create` + `gh release upload --clobber`.

The built APK is also saved as a versioned `faazio-<version>-apk` Actions artifact for direct
download.

### Build flags (faster + smaller + obfuscated)

- **2-ABI build** — `REACT_NATIVE_ARCHS=arm64-v8a,armeabi-v7a` (env in the workflow) is passed as
  `-PreactNativeArchitectures`. Covers ~95% of devices while roughly halving native (C++)
  compile work and the `.so` payload vs the old 4-ABI universal build. Override to
  `arm64-v8a` for an even smaller (arm64-only) APK.
- **R8 minify + resource shrink ON** — passed as `-Pandroid.enableMinifyInReleaseBuilds=true`
  and `-Pandroid.enableShrinkResourcesInReleaseBuilds=true`. These read the committed
  `android/app/build.gradle`'s `findProperty`. Smaller dex + obfuscation (raises the reverse-engineering bar for
  prescriptions/payments logic per the security mandate).

### R8 mapping file (crash retracing)

Minified builds produce `android/app/build/outputs/mapping/release/mapping.txt`. It is uploaded
as a **private Actions artifact** (`faazio-mapping-<run_id>`) — never attach it to the public
GitHub Release (that would defeat obfuscation). To retrace a release stack trace, see
`docs/RUNBOOKS/TROUBLESHOOTING.md` → "Retracing a minified crash".

### Mandatory smoke test (R8 gate)

R8 keep-rule gaps only surface at runtime. Before trusting a minified release, install it on a
device and walk the core flows: **Home → Cart → Checkout → Pharma**. See
`docs/RUNBOOKS/TROUBLESHOOTING.md` → "Minified (R8) release install" for how to install.

### Install the release APK on a device

```bash
cd /tmp/opencode
gh release download v1.0.2 --repo FaizalBasha-123/faazio-workspace --pattern "*.apk" --clobber
adb install -r app-release.apk
```

> The release APK is a **static release build** — it does **not** hot-reload. For instant preview
> on code changes, use `npm run start` + a debug APK. See `docs/RUNBOOKS/CI_PIPELINE.md` for
> the dev-vs-CI decision table. If a debug-signed Faazio is already installed, uninstall it first
> (`adb uninstall com.faazio.customer`).

### Debug build (CI-only)

**Never build locally** (`npm run android` / `react-native run-android` / `./gradlew`) — the host's
`systemd-oomd` kills Gradle under memory pressure. Build on GitHub's runners instead:

```bash
gh workflow run android-debug.yml
gh run watch
gh run download <run-id> -n faazio-debug-apk   # -> app-debug.apk
adb install -r app-debug.apk
adb reverse tcp:8081 tcp:8081                   # then `npm run start` locally for Metro
```

See `docs/RUNBOOKS/CI_PIPELINE.md` → "Trigger a debug build".

### No local release build (CI-only)

There is **no supported local release build** — `./gradlew assembleRelease` is forbidden on this
machine (systemd-oomd OOM-kills Gradle). Use `gh workflow run "Release APK"` (see
`docs/RUNBOOKS/CI_PIPELINE.md`). The CI workflow runs the equivalent of:

```bash
npm run configure                       # release env: CONFIGURE_RELEASE=1, GATEWAY_URL, USE_GATEWAY,
                                        # CERT_PINS, USE_FIREBASE_AUTH, GOOGLE_MAPS_API_KEY_ANDROID,
                                        # GOOGLE_PLACES_API_KEY
bash scripts/restore-keystore.sh
cd android && ./gradlew assembleRelease --no-daemon \
  -PreactNativeArchitectures=arm64-v8a,armeabi-v7a \
  -Pandroid.enableMinifyInReleaseBuilds=true \
  -Pandroid.enableShrinkResourcesInReleaseBuilds=true
```

To verify a **downloaded** APK is signed with the release cert (not the debug cert):
```bash
apksigner verify --verbose --print-certs app-release.apk
# EXPECT "Signer #1 certificate DN: CN=Faazio, ..."  (release cert, NOT "CN=Android Debug")
```
## 🌐 Google Play (manual)

1. Build the release `.aab` (`./gradlew bundleRelease` with the release keystore; CI-only on this host).
2. Sign in to [Play Console](https://play.google.com/console/), open the Faazio app
   (package `com.faazio.customer`).
3. **Testing** → create a release, upload the `.aab`.
4. Fill metadata, Content Rating, and Data Safety (note CAMERA + location + media permissions and
   Keychain/Keystore token storage).
5. **Rollout** to begin review.

> See `client/mobile/docs/PLAYSTORE_RELEASE.md` for store-console specifics.

## 🍎 App Store (iOS)

Requires macOS + Xcode; run `cd client/mobile && npm install && cd ios && pod install` first.

```bash
cd client/mobile
npm run ios                                    # debug build + Metro in simulator
# release: open ios/Faazio.xcworkspace, Product → Scheme → Edit Scheme → Release, then Archive
```

- Bundle id `com.faazio.customer` (from the Xcode project / `project.pbxproj`).
- Upload via Xcode Organizer / Transporter; then fill App Store Connect metadata.
- `ios/Faazio/Info.plist` declares camera, photo-library, and location usage strings.

## 🌍 Web (Partner Portal) — Vercel

The portal (`client/web/platform`) deploys **zero-config** on Vercel: import the
repo, set **Root Directory** to `client/web/platform`, framework preset
**Next.js**, then set the `NEXT_PUBLIC_*` env vars in the project (unset ⇒ seed
mode). `vercel.json` ships the security headers, `engines.node` pins the build
runtime, and `public/robots.txt` + `metadata.robots` keep the console
unindexed. See `docs/architecture/web-portal.md` → "Deployment (Vercel)".

Only `NEXT_PUBLIC_GATEWAY_URL` (and optionally `NEXT_PUBLIC_MEDIA_CDN_BASE`) is
required — portal auth is the only auth mode. The gateway needs
`PORTAL_JWT_SECRET`, `PORTAL_PEPPER`, migrations `0032` + `0033` + `0034` + `0038` applied, and at
least one superadmin provisioned. Full provisioning/rotation/rollback steps:
`docs/RUNBOOKS/PORTAL_AUTH.md`.

`NEXT_PUBLIC_*` is inlined at build time: **changing it in the Vercel project requires a redeploy**
(an old build keeps the previous origin). `npm run build` runs `scripts/check-env.mjs --strict` and
fails the build when `NEXT_PUBLIC_GATEWAY_URL` is missing, so a deployment can never ship with every
portal auth route returning `503 not_configured`.

### Razorpay Route (seller splits)

Migrations `0039` (seller onboarding + Route columns) and `0040` (webhook/reversal payout states)
must be applied before deploying this gateway. `RAZORPAY_ROUTE_KEY_ID` / `RAZORPAY_ROUTE_KEY_SECRET` /
`RAZORPAY_ROUTE_WEBHOOK_SECRET` are optional: they fall back to the existing `RAZORPAY_KEY_ID` /
`RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET`. With no keys the Route client stays in mock mode
(linked accounts/transfers are synthetic, the hold releaser is disabled and the webhook rejects every
signature), so a staging deploy never marks a payout PAID without a real transfer. Register the Route
webhook in the Razorpay dashboard at `https://<gateway>/webhooks/razorpay/route` for
`transfer.released`, `transfer.failed` and `transfer.reversed`. The private KYC bucket is
`R2_PRIVATE_BUCKET`; KYC images are never public.

## ✅ Release checklist

- [ ] `npm run ts:check` and `npm run check:boundaries` pass.
- [ ] Version bumped in `package.json` **and** `android/app/build.gradle` `versionCode` (+1 every release).
- [ ] `CERT_PINS` set and Firebase native config committed when `USE_GATEWAY=true` (release configure fails without them).
- [ ] GitHub secrets set: `KEYSTORE_BASE64`, `KEYSTORE_PASS`, `KEY_ALIAS`, `ALIAS_PASS` (keystore backed up).
- [ ] Release APK signed with the **release cert** (`CN=Faazio`), not the debug cert.
- [ ] `gh workflow run release-apk.yml` succeeded and the signed APK is on the GitHub Release.
- [ ] Portal (if deploying): `0032` + `0033` applied, `PORTAL_JWT_SECRET`/`PORTAL_PEPPER` set, a superadmin hash provisioned (`PORTAL_AUTH.md`).
- [ ] Seller splits: `0039` + `0040` applied; Route keys + webhook endpoint/secret set (or the `RAZORPAY_*` fallback used); `R2_PRIVATE_BUCKET` set.
- [ ] Release signed and smoke-tested on a device (R8 gate: Home → Cart → Checkout → Pharma).
- [ ] Store metadata / data-safety updated.

### Expected build-time / size impact (CI workflow)

| Metric | Before | After (2-ABI + R8) |
|---|---|---|
| CI build time | ~43 min (cold) | ~18–26 min (cached) |
| GitHub APK download | universal 4-ABI, unminified | ~−50% (2-ABI, minified) |
| Dex size / cold start | unminified | smaller dex (R8) → faster cold start |
