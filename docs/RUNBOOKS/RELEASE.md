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

### Register the release cert (Firebase + Google Play + Maps keys)

The release keystore's fingerprints are public (not secrets) and **must be whitelisted before a
signed build can verify phone OTP or render restricted Maps keys**. They are **identical for all
three apps** (one keystore signs customer, delivery, seller):

| Signing cert (`CN=Faazio`, alias `faazio`) | SHA-1 | SHA-256 |
|---|---|---|
| All three applicationIds | `7E:B1:2E:78:55:21:89:FF:6B:37:1A:FE:2F:F0:84:DE:58:42:A8:45` | `23:8A:02:B2:0F:64:E6:EB:8A:33:17:39:75:A9:AE:C7:DD:66:CC:72:83:E1:0B:3B:EF:F4:70:01:4E:E4:09:9D` |

- **Firebase** (Project Settings → Your apps): add the **release** SHA-1/SHA-256 to every Android
  app (`com.faazio.customer`, `com.faazio.deliverypartner`, `com.faazio.sellerpartner`). Without it
  the release build fails phone OTP with `auth/invalid-app-credential`. See
  `docs/RUNBOOKS/FIREBASE_AUTH.md` §4.
- **Maps / Places API keys**: restrict the Android keys to each app's package **+ the release
  SHA-1** (the debug key's SHA-1 is not accepted for the signed build). See TROUBLESHOOTING.md →
  "Location / maps".
- **Google Play Console** (Setup → App signing): the first AAB upload from this keystore registers
  the **upload key**; confirm Play shows the SHA-256 above, or future uploads from this keystore are
  rejected.
- Drill the fingerprints with `keytool -list -v -keystore faazio-release.keystore -alias faazio`.
- Private copy (gitignored, safe to edit): `client/mobile/keystore/RELEASE_CERT_FINGERPRINTS.md`.

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
| `GATEWAY_URL` | deployed gateway origin, `https://…` (release refuses `http://`); defaults to `https://api.faazio.com` (Cloudflare edge) |
| `WEB_PORTAL_URL` | deployed web Partner Portal origin, `https://…` (required for `app=seller`; release refuses `http://`). Set as a repo variable/secret; defaults to `https://app.faazio.com` in both workflows. A seller build fails `configure.js` when it is empty |
| `USE_GATEWAY` | `true` to embed the live gateway (defaults to `true` in the workflow) |
| `CERT_PINS` | comma-separated base64 SHA-256 SPKI pins for the gateway host |
| `GOOGLE_MAPS_API_KEY_ANDROID` | restricted Maps SDK key; `configure.js` writes the manifest string resource (empty ⇒ blank shop-pin map) |
| `GOOGLE_PLACES_API_KEY` | restricted Places API (New) key for address autocomplete (empty ⇒ static suggestions) |
| `USE_FIREBASE_AUTH` | `true` (default) — phone OTP via the committed native Firebase config |
| `GOOGLE_SERVICES_DELIVERY_JSON` | the **partner** Android `google-services.json` (Firebase app registered for `com.faazio.deliverypartner`); required only for `app=delivery` builds |
| `GOOGLE_SERVICES_SELLER_JSON` | the **seller** Android `google-services.json` (Firebase app registered for `com.faazio.sellerpartner`); required for `app=seller` builds. The iOS `Seller-*` configuration copies `GoogleService-Info-Seller.plist`. |

Both workflows pass `GOOGLE_MAPS_API_KEY_ANDROID` and `GOOGLE_PLACES_API_KEY` to `configure.js`
after typecheck (debug accepts them as repository variables or secrets; release uses secrets), so a
CI-built partner APK can render the map. An empty key is still a supported degraded mode.

`configure.js` **fails the release** when `USE_GATEWAY=true` and `CERT_PINS` is missing, or when
`USE_FIREBASE_AUTH=false`, or when `android/app/google-services.json` /
`ios/Faazio/GoogleService-Info.plist` is absent — a release must never embed a mock-login or
unpinned build. The Firebase files are **public client config** (not secrets) and are committed so
CI can build; see `docs/RUNBOOKS/FIREBASE_AUTH.md`.

### Certificate-pin rotation

Behind Cloudflare the app pins the **Cloudflare edge cert** served at `api.faazio.com` (Universal
SSL — issued to the zone, auto-rotated by Cloudflare) — **not** Render's origin Let's Encrypt cert.
Keep **two** pins live during a rotation so an in-flight app never fails closed:
1. Add the new SPKI SHA-256 pin alongside the current one in `CERT_PINS` (and in the CI secret) —
   2-pin overlap. Derive it from the edge chain Cloudflare actually presents:
   `openssl s_client -connect api.faazio.com:443 -servername api.faazio.com </dev/null 2>/dev/null | openssl x509 -pubkey -noout | openssl pkey -pubin -outform der | openssl dgst -sha256 -binary | openssl enc -base64`
2. Ship a release with both pins; wait for adoption.
3. ≥30 days before the current edge cert rotates, cut over to the new pin only (search the old expiry
   and schedule the removal).

If the edge cert changes before a pinned release is updated, clients fail closed (intended) — the
network-security-config is what blocks a MITM even with a valid CA.

## 🚀 Release a new APK (GitHub Actions + gh CLI)

Release builds are **not** run on a local machine — they build and publish in GitHub Actions,
triggered with the `gh` CLI.

```bash
cd client/mobile
# 1) Bump the version (or pass it to the workflow)
#    edit package.json -> version, e.g. "1.1.0"
#    Passing -f version=<semver> makes the workflow derive versionCode from it
#    (e.g. 1.0.4 -> 10004). Without -f version, bump versionCode (+1) and
#    versionName in android/app/build.gradle yourself.

# 2) Trigger the CI build + release (app=customer|delivery)
gh workflow run release-apk.yml -f app=customer -f version=1.0.2 -f tag=v1.0.2

# 3) Watch it finish
gh run watch

# 4) The signed APK is attached to the GitHub Release v1.0.2
#    (gh release upload --clobber replaces any previous APK on that tag).
```

The workflow: checkout → setup Node 24 + JDK 21 → `gradle/actions/setup-gradle` (caches
`~/.gradle` + build cache) → **CI Gradle tuning** (overrides laptop memory caps via
`~/.gradle/gradle.properties`) → `npm ci` → set version (optional override; derives `versionCode`
from the semver) → `restore-keystore.sh` → `npm run ts:check` + `npm run check:boundaries` →
`npm run configure` (release cert pins + JS config) → `./gradlew assemble<App>Release
bundle<App>Release` with **ABI + R8 minify flags** (see below) → upload APK + AAB artifacts →
upload **R8 `mapping.txt` (private artifact)** → `gh release create` + `gh release upload --clobber`.

The built APK + AAB are also saved as versioned Actions artifacts for direct download:
`faazio-<app>-<version|-release>-apk` and `faazio-<app>-<version|-release>-aab`
(e.g. `faazio-customer-1.0.4-apk`, or `...-release-apk` when `-f version` is left empty).

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

Minified builds produce `android/app/build/outputs/mapping/<flavor>Release/mapping.txt` (e.g.
`mapping/customerRelease/mapping.txt`). It is uploaded as a **private Actions artifact**
(`faazio-<app>-mapping-<run_id>`) — never attach it to the public
GitHub Release (that would defeat obfuscation). To retrace a release stack trace, see
`docs/RUNBOOKS/TROUBLESHOOTING.md` → "Retracing a minified crash".

### Mandatory smoke test (R8 gate)

R8 keep-rule gaps only surface at runtime. Before trusting a minified release, install it on a
device and walk the core flows: **Home → Cart → Checkout → Pharma**. See
`docs/RUNBOOKS/TROUBLESHOOTING.md` → "Minified (R8) release install" for how to install.

### Install the release APK on a device

```bash
cd /tmp/opencode
gh release download v1.0.2 --repo FaizalBasha-123/faazio-workspace --pattern "app-*-release.apk" --clobber
adb install -r app-customer-release.apk   # flavor-named: app-delivery-release.apk / app-seller-release.apk
```

> The release APK is a **static release build** — it does **not** hot-reload. For instant preview
> on code changes, use `npm run start` + a debug APK. See `docs/RUNBOOKS/CI_PIPELINE.md` for
> the dev-vs-CI decision table. If a debug-signed Faazio is already installed, uninstall it first
> (`adb uninstall com.faazio.customer`).

### Debug build (CI-only)

**Never build locally** (`npm run android` / `react-native run-android` / `./gradlew`) — the host's
`systemd-oomd` kills Gradle under memory pressure. Build on GitHub's runners instead:

```bash
gh workflow run android-debug.yml -f app=customer   # or -f app=delivery
gh run watch
gh run download <run-id> -n faazio-customer-debug-apk   # -> app-customer-debug.apk
adb install -r app-customer-debug.apk
adb reverse tcp:8081 tcp:8081                   # then `npm run start` locally for Metro
```

`app=delivery` builds the standalone partner app (`com.faazio.deliverypartner`); it requires the
`GOOGLE_SERVICES_DELIVERY_JSON` secret. See `docs/RUNBOOKS/CI_PIPELINE.md` → "Trigger a debug build".

### No local release build (CI-only)

There is **no supported local release build** — `./gradlew assembleRelease` is forbidden on this
machine (systemd-oomd OOM-kills Gradle). Use `gh workflow run "Release APK"` (see
`docs/RUNBOOKS/CI_PIPELINE.md`). The CI workflow runs the equivalent of:

```bash
npm run configure                       # release env: CONFIGURE_RELEASE=1, GATEWAY_URL, USE_GATEWAY,
                                        # CERT_PINS, USE_FIREBASE_AUTH, GOOGLE_MAPS_API_KEY_ANDROID,
                                        # GOOGLE_PLACES_API_KEY
bash scripts/restore-keystore.sh
cd android && ./gradlew assembleCustomerRelease --no-daemon \
  -PreactNativeArchitectures=arm64-v8a,armeabi-v7a \
  -Pandroid.enableMinifyInReleaseBuilds=true \
  -Pandroid.enableShrinkResourcesInReleaseBuilds=true
```

The Android project has three product flavors: `customer` (`com.faazio.customer`), `delivery`
(`com.faazio.deliverypartner`, label "Faazio Delivery Partner") and `seller`
(`com.faazio.sellerpartner`, label "Faazio Seller Partner"). Always name the flavor in the task —
`assembleDebug` would try all three and each partner flavor needs its own Firebase config. The same
split exists on iOS as the `Delivery-Debug` / `Delivery-Release` and `Seller-Debug` / `Seller-Release`
build configurations.

To verify a **downloaded** APK is signed with the release cert (not the debug cert):
```bash
apksigner verify --verbose --print-certs app-customer-release.apk
# EXPECT "Signer #1 certificate DN: CN=Faazio, ..."  (release cert, NOT "CN=Android Debug")
```
## 🌐 Google Play (manual)

1. Build the release `.aab` (`./gradlew bundleCustomerRelease` with the release keystore;
   the workflow already produces it — for Play upload use the `.aab` attached to the GitHub Release).
2. Sign in to [Play Console](https://play.google.com/console/), open the Faazio app
   (package `com.faazio.customer`).
3. **Testing** → create a release, upload the `.aab`.
4. Fill metadata, Content Rating, and Data Safety (note CAMERA + location + media permissions and
   Keychain/Keystore token storage).
   - **Target audience:** 18+ only, minors restricted.
   - **Delete account URL:** `https://faazio.com/privacy` (prominent `#delete-account` steps);
     in-app: Account → Privacy and security → Delete account.
   - **Delete data without deleting account:** Yes (Request data deletion).
   - **Advertising ID:** No (no ad SDK / `AD_ID` permission).
   - **Financial:** mobile payments/digital wallets + rewards/points. **Health:** medication and
     treatment management + healthcare services.
   - Full answer sheet: `client/mobile/docs/PLAYSTORE_RELEASE.md` Step 3c.
5. **Rollout** to begin review.

> See `client/mobile/docs/PLAYSTORE_RELEASE.md` for store-console specifics.

## 🍎 App Store (iOS)

Requires macOS + Xcode; run `cd client/mobile && npm install && cd ios && pod install` first.

The partner app is a separate listing built from the same target with the `Delivery-Release`
configuration (`com.faazio.deliverypartner`, display name "Faazio Delivery Partner"). The seller
listing uses the `Seller-Release` configuration (`com.faazio.sellerpartner`, display name
"Faazio Seller Partner"). Before archiving the delivery app:
1. Put the partner `GoogleService-Info-Delivery.plist` in `ios/Faazio/` (the build phase copies it
   over the bundled customer plist; a Delivery build fails without it).
2. Run `APP_VARIANT=delivery npm run configure` (the bundle phase hard-fails otherwise). The
   `Delivery-*` configurations bundle `index.delivery.js` (set as `ENTRY_FILE` by the build phase);
   customer configurations use `index.js`.
3. In Xcode, Edit Scheme → Archive → Build Configuration → `Delivery-Release`, then Archive.

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

## 🛒 Web (Landing page) — Vercel

The marketing landing page (`client/web/landingpage`) deploys **zero-config** on Vercel: import the
repo, set **Root Directory** to `client/web/landingpage`, and Vercel runs `bun run build` (TanStack
Start + Nitro). `vercel.json` only ships security/caching headers. See
`client/web/landingpage/README.md` for the project contract.

Because builds are immutable on Vercel, **a merged commit does not go live until the production
deployment runs.** If `https://faazio.com` serves a stale page (e.g. the Play data-safety
`https://faazio.com/privacy#delete-account` anchor not resolving), trigger a redeploy of the same
commit:

- **Vercel dashboard:** open the landingpage project → **Deployments** → latest **Production**
  deployment → **⋮ → Redeploy**.
- **Vercel CLI** (authenticated): from `client/web/landingpage`, `vercel --prod`.
- **No-op commit + push** falls back to an automatic production build when a deploy hook is wired.

Verify afterwards: `https://faazio.com/privacy#delete-account` renders "Delete your account".

## 🚀 Server (Gateway) — Render + database migrations

The gateway deploys to **Render** (repo-root `render.yaml` Blueprint → `server/gateway/Dockerfile`,
`/health`). **Render never applies migrations** — the runtime image is distroless with only the
binary, and the gateway only logs `hint=apply migration NN` for a missing schema. Migrations land
exclusively from a dev terminal:

```bash
cd server/gateway
set -a && . ./.env && set +a                 # creds for the same Supabase pooler the gateway uses
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ../supabase/migrations/0050_district_rls.sql   # each pending file
```

Run **each pending** migration (numeric order) → then roll the Render deploy. Release order is
**DB first, gateway second**. Full command set + fresh-DB/seed flow:
`docs/RUNBOOKS/DATABASE_MIGRATIONS.md`.

## ✅ Release checklist

- [ ] `npm run ts:check` and `npm run check:boundaries` pass (both are CI steps).
- [ ] `versionCode` > the previous release (committed +1 bump, or derived from `-f version` semver — e.g. `1.0.4` → `10004`).
- [ ] Release keystore SHA-1/SHA-256 registered in Firebase for all three Android apps and the Maps/Places keys restricted to the release SHA-1 (see "Register the release cert").
- [ ] `CERT_PINS` set and Firebase native config committed when `USE_GATEWAY=true` (release configure fails without them).
- [ ] GitHub secrets set: `KEYSTORE_BASE64`, `KEYSTORE_PASS`, `KEY_ALIAS`, `ALIAS_PASS` (keystore backed up).
- [ ] Release APK signed with the **release cert** (`CN=Faazio`), not the debug cert.
- [ ] `gh workflow run release-apk.yml` succeeded and the signed APK is on the GitHub Release.
- [ ] Portal (if deploying): `0032` + `0033` applied, `PORTAL_JWT_SECRET`/`PORTAL_PEPPER` set, a superadmin hash provisioned (`PORTAL_AUTH.md`).
- [ ] **Server/Render:** all `server/supabase/migrations/` files up to the latest are applied from a dev terminal (`DATABASE_MIGRATIONS.md` — Render never auto-applies); then the gateway deploy rolled.
- [ ] Push delivery: `FCM_PROJECT_ID` + `FCM_SERVICE_ACCOUNT_JSON` (server-side Firebase service-account key — a Render secret env var) set for the gateway's embedded FCM sender. See `FIREBASE_AUTH.md`.
- [ ] Seller splits: `0039` + `0040` applied; Route keys + webhook endpoint/secret set (or the `RAZORPAY_*` fallback used); `R2_PRIVATE_BUCKET` set.
- [ ] Release signed and smoke-tested on a device (R8 gate: Home → Cart → Checkout → Pharma).
- [ ] Store metadata / data-safety updated (see Google Play §4 answer sheet; delete-account URL + in-app flow verified).

### Expected build-time / size impact (CI workflow)

| Metric | Before | After (2-ABI + R8) |
|---|---|---|
| CI build time | ~43 min (cold) | ~18–26 min (cached) |
| GitHub APK download | universal 4-ABI, unminified | ~−50% (2-ABI, minified) |
| Dex size / cold start | unminified | smaller dex (R8) → faster cold start |
