# Release Runbook

> Build, sign, and ship the Faazio mobile app.

> **Prefer `docs/RUNBOOKS/CI_PIPELINE.md`** for the CI-based build/release flow (gh CLI + GitHub
> Actions). This runbook covers the manual/local steps and store upload as fallback.

## 🔑 Signing credentials

- Debug builds use the generated debug keystore (automatic).
- **Each product has its own release keystore.** The CI workflow
  (`.github/workflows/release-apk.yml`) runs `scripts/restore-keystore.sh <app>`, which decodes the
  matching `KEYSTORE_BASE64_<APP>` secret and writes that product's properties file before
  `./gradlew assemble<App>Release`. A release build without that product's file fails fast.
  - customer → `keystore/keystore.properties` / `faazio-release.keystore` (alias `faazio`)
  - delivery → `keystore/keystore-delivery.properties` / `faazio-delivery-release.keystore` (alias `faazio-delivery`)
  - seller → `keystore/keystore-seller.properties` / `faazio-seller-release.keystore` (alias `faazio-seller`)
- The keystore files live at `client/mobile/keystore/` (gitignored).
  **Back all three up securely — losing one means you can never update that app on the store.**
- **Release signing must use the release keystore, not the debug keystore.** A debug-signed
  build (`CN=Android Debug`) differs from the release cert (`CN=Faazio…`); a user who installed
  one can no longer update — Android reports a signature conflict as
  **"App not installed as package appears to be invalid."** `android/app/build.gradle` assigns each
  product flavor its own release signing config and never falls back to the debug key. CI also runs
  `apksigner verify` and fails if the APK is not signed with a `CN=Faazio…` certificate.
- **Signature schemes:** release APKs are signed with **v2 (APK Signature Scheme) only** (plus v3),
  which is correct for `minSdkVersion 24` (Android 7.0+). v1 (JAR) signing is intentionally omitted
  by both AGP and `apksigner` when minSdk ≥ 24 and is not required for install on Android 7.0+.

### Register the release cert (Firebase + Google Play + Maps keys)

Each product has its own signing cert, so the fingerprints are **different per app**. They are
public (embedded in every signed APK) but must be whitelisted before a signed build can verify
phone OTP or render restricted Maps keys:

| App (applicationId) | Keystore / alias | SHA-1 | SHA-256 |
|---|---|---|---|
| customer (`com.faazio.customer`) | `faazio-release.keystore` / `faazio` | `7E:B1:2E:78:55:21:89:FF:6B:37:1A:FE:2F:F0:84:DE:58:42:A8:45` | `23:8A:02:B2:0F:64:E6:EB:8A:33:17:39:75:A9:AE:C7:DD:66:CC:72:83:E1:0B:3B:EF:F4:70:01:4E:E4:09:9D` |
| delivery (`com.faazio.deliverypartner`) | `faazio-delivery-release.keystore` / `faazio-delivery` | `6A:D2:A2:E2:C8:A0:1D:66:09:61:EF:9E:C4:E8:40:1B:8B:86:CD:93` | `E1:B6:1B:A9:86:F6:76:C4:A0:C0:D5:EF:26:E9:25:8C:78:95:7C:A9:04:7F:E9:39:96:F3:E5:C5:96:E5:5E:ED` |
| seller (`com.faazio.sellerpartner`) | `faazio-seller-release.keystore` / `faazio-seller` | `5F:03:B7:B1:C6:B6:6D:7C:DB:86:8E:3C:A7:E5:F3:4F:B4:02:5E:20` | `B7:DA:DE:58:08:F8:EB:9D:3D:EB:F8:BC:12:E6:75:5E:46:A2:F4:E5:7A:C2:C9:56:AA:06:45:10:18:1E:B7:A6` |

- **Firebase** (Project Settings → Your apps): add **each app's own** release SHA-1/SHA-256 to its
  matching Android app registration. Without it that build fails phone OTP with
  `auth/invalid-app-credential`. See `docs/RUNBOOKS/FIREBASE_AUTH.md` §4.
- **Maps / Places API keys**: only the **customer** and **delivery** apps mount a native map
  (customer "Sell with us" pin picker, delivery route). Restrict each shared key to those packages
  **+ each app's release SHA-1** (the debug SHA-1 is not accepted). The **seller** app is a WebView
  shell with no `MapView`, so its package is **not** needed on the Maps/Places allowlist and its
  flavor strips the key (`tools:node="remove"` + an empty string override under
  `android/app/src/seller/`). The workflow passes one shared `GOOGLE_MAPS_API_KEY_ANDROID` /
  `GOOGLE_PLACES_API_KEY`; create per-app keys in Google Cloud and set per-app secrets if you want
  them independent. See TROUBLESHOOTING.md → "Location / maps".
- **Google Play Console** (Setup → App signing): each listing's first AAB upload registers that app's
  **upload key**; confirm Play shows the matching SHA-256 above.
- Drill a fingerprint with `keytool -list -v -keystore <file> -alias <alias>` (store password from
  the matching `keystore[-app].properties`).
- Private copy (gitignored, safe to edit): `client/mobile/keystore/RELEASE_CERT_FINGERPRINTS.md`.

> Never commit any `keystore*.properties` or `.keystore` file. All are gitignored.
> `android/` and `ios/` are committed source-of-truth shells; CI does **not** regenerate them.

### GitHub secrets (set once)

The per-product keystores + signing properties are stored as GitHub repository secrets
(`gh secret set <NAME>`); they are never committed. `<APP>` = `CUSTOMER` / `DELIVERY` / `SELLER`:

| Secret | Value |
|---|---|
| `KEYSTORE_BASE64_<APP>` | `openssl base64 -A -in client/mobile/keystore/<app store file>` (single line) |
| `KEYSTORE_PASS_<APP>` | value from that app's `keystore[-app].properties` |
| `KEY_ALIAS_<APP>` | value from that app's properties (`faazio` / `faazio-delivery` / `faazio-seller`) |
| `ALIAS_PASS_<APP>` | value from that app's properties |
| `STORE_FILE_<APP>` | (optional) keystore file name; defaults per app |
| `GATEWAY_URL` | deployed gateway origin, `https://…` (release refuses `http://`); defaults to `https://api.faazio.com` (Cloudflare edge) |
| `WEB_PORTAL_URL` | deployed web Partner Portal origin, `https://…` (required for `app=seller`; release refuses `http://`). Set as a repo variable/secret; defaults to `https://app.faazio.com` in both workflows. A seller build fails `configure.js` when it is empty |
| `USE_GATEWAY` | `true` to embed the live gateway (defaults to `true` in the workflow) |
| `CERT_PINS` | comma-separated base64 SHA-256 SPKI pins for the gateway host — derive with `scripts/cert-pins.sh` (see "Certificate-pin rotation") |
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

### Back up the keystores

Three keystores sign three apps; losing one blocks updates for that app. Keep a **local
(gitignored) copy** and an **encrypted offsite copy**.

Local copy (lives beside the live keys; `/keystore/` is gitignored, so it is never committed):

```bash
cd client/mobile/keystore
mkdir -p backup && chmod 700 backup
cp faazio-*-release.keystore keystore*.properties RELEASE_CERT_FINGERPRINTS.md backup/
chmod 600 backup/*
```

Encrypted offsite archive — store the passphrase in a password manager/vault, then copy the `.enc`
file to an external drive or cloud vault (never commit key material or a plaintext archive):

```bash
cd client/mobile
tar -czf - keystore \
  | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -out ~/faazio-keystores-$(date +%F).tar.gz.enc
# restore:
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in ~/faazio-keystores-<date>.tar.gz.enc | tar -xzf -
```

Restore on a new machine: extract, `cp` the files into `client/mobile/keystore/`, `chmod 600` them,
and re-set the GitHub secrets from `keystore[-app].properties` (`scripts/restore-keystore.sh <app>`
reconstructs them in CI). A local copy alone is **not** a backup: Play can reset an *upload* key only
while Google holds the app-signing key, and a sideloaded app can never be updated after its signing
key is lost.

### Certificate-pin rotation

Behind Cloudflare the app pins the TLS certificate chain served at `api.faazio.com` (Universal SSL —
issued by Cloudflare's CA, auto-rotated) — **not** Render's origin cert. Android allows a connection
when **any** certificate in the presented chain matches a pin, so ship **both the leaf and its
issuing intermediate CA**. That way a routine leaf rotation (Cloudflare reissues roughly every 90
days) does not require an app update; only a full CA change does.

```bash
cd client/mobile
scripts/cert-pins.sh          # prints "<leaf-pin>,<intermediate-pin>" (subject -> pin on stderr)
```

Put that comma-separated value in every Android env file (`client/mobile/.env.android.customer`,
`.env.android.delivery`, `.env.android.seller`) and `client/mobile/.env.ios` **and** the `CERT_PINS`
GitHub secret (`gh secret set CERT_PINS`).

Rotation playbook:
1. Re-run `scripts/cert-pins.sh` after any chain change and update all four env files + the
   `CERT_PINS` secret.
2. Ship a release with the fresh pins; during an overlap window keep the previous pins too so an
   in-flight app never fails closed.
3. Never pin the root (servers may omit it from the served chain).

If the served chain changes before a pinned release is updated, clients fail closed (intended) — the
network-security-config is what blocks a MITM even with a valid CA. This is a real operational
hazard: an edge rotation on 2026-10-29 left the shipped v1.0.5 leaf pin stale — re-derive and
rebuild whenever the edge cert changes.

## 🚀 Release a new APK (GitHub Actions + gh CLI)

Release builds are **not** run on a local machine — they build and publish in GitHub Actions,
triggered with the `gh` CLI.

```bash
cd client/mobile
# 1) Bump the version: edit package.json -> version, e.g. "1.1.0", OR pass
#    -f version=<semver>. Either way the workflow derives versionCode from the
#    resolved semver (e.g. 1.0.4 -> 10004) and rewrites build.gradle versionName
#    + versionCode, so the committed values are never stale.

# 2) Trigger the CI build + release (app=customer|delivery|seller).
#    Default is APK-only; add -f include-aab=true to also build + attach the
#    Play-bound AAB.
gh workflow run release-apk.yml -f app=customer -f version=1.0.2 -f tag=v1.0.2
# with Play AAB:
gh workflow run release-apk.yml -f app=customer -f version=1.0.2 -f tag=v1.0.2 -f include-aab=true

# 3) Watch it finish
gh run watch

# 4) The signed APK is attached to the GitHub Release v1.0.2
#    (gh release upload --clobber replaces any previous APK on that tag).
```

The workflow: checkout → setup Node 24 + JDK 21 → `gradle/actions/setup-gradle` (caches
`~/.gradle` + build cache) → **CI Gradle tuning** (overrides laptop memory caps via
`~/.gradle/gradle.properties`) → `npm ci` → set version (derives `versionName` + `versionCode` from
the resolved semver, using `package.json` when `-f version` is omitted) → `restore-keystore.sh <app>` →
`npm run ts:check` + `npm run check:boundaries` →
`npm run configure` (release cert pins + JS config) → `./gradlew assemble<App>Release` with
**ABI + R8 minify flags** (see below), plus `bundle<App>Release` when `-f include-aab=true` →
upload APK artifact (+ AAB artifact when `include-aab`) → upload **R8 `mapping.txt` (private
artifact)** → `gh release create` + `gh release upload --clobber` (the AAB is attached to the
release only when `include-aab=true`).

The built APK is also saved as a versioned Actions artifact for direct download:
`faazio-<app>-<version|-release>-apk` (and `faazio-<app>-<version|-release>-aab` when
`include-aab=true`), e.g. `faazio-customer-1.0.4-apk`, or `...-release-apk` when `-f version`
is left empty.

### Build flags (faster + smaller + obfuscated)

- **arm64-only build** — `REACT_NATIVE_ARCHS=arm64-v8a` (env in the workflow) is passed as
  `-PreactNativeArchitectures`. 64-bit devices only; roughly halves native (C++) compile work
  and the `.so` payload vs the old 4-ABI universal build. Re-add `armeabi-v7a` in the workflow
  env only if 32-bit device support is required.
- **AAB on demand** — the Play-bound `.aab` is built and attached only when the release is
  dispatched with `-f include-aab=true`; the default dispatch is APK-only.
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
bash scripts/restore-keystore.sh customer
cd android && ./gradlew assembleCustomerRelease --no-daemon \
  -PreactNativeArchitectures=arm64-v8a \
  -Pandroid.enableMinifyInReleaseBuilds=true \
  -Pandroid.enableShrinkResourcesInReleaseBuilds=true
```

The Android project has three product flavors: `customer` (`com.faazio.customer`), `delivery`
(`com.faazio.deliverypartner`, label "Faazio Delivery Partner") and `seller`
(`com.faazio.sellerpartner`, label "Faazio Seller Partner"). Always name the flavor in the task —
`assembleDebug` would try all three and each partner flavor needs its own Firebase config. The same
split exists on iOS as the `Delivery-Debug` / `Delivery-Release` and `Seller-Debug` / `Seller-Release`
build configurations.

All three flavors share **one committed native shell and one dependency set** (`android/` + `ios/`;
deps declared once in `package.json`), so a native library such as `react-native-maps` is compiled into
every APK even if one product never uses it. Never delete a shared dependency to slim a single app —
scope the exclusion in that flavor's manifest/resources instead (the seller flavor strips the Maps key
this way). CI builds each flavor separately; do not build two in one Gradle task.

To verify a **downloaded** APK is signed with the release cert (not the debug cert):
```bash
apksigner verify --verbose --print-certs app-customer-release.apk
# EXPECT "Signer #1 certificate DN: CN=Faazio, ..."  (release cert, NOT "CN=Android Debug")
```
## 🌐 Google Play (manual)

1. Build the release `.aab` — dispatch the workflow with `-f include-aab=true` (it runs
   `bundleCustomerRelease` with the release keystore; the default APK-only release does **not**
   produce one). Download the `.aab` from the GitHub Release or the `faazio-<app>-<version>-aab`
   Actions artifact.
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

### CI release (preferred)

Build the signed `.ipa` and upload it to TestFlight in GitHub Actions — no local Mac needed:

```bash
gh workflow run ios-release.yml -f app=customer -f version=1.0.6 -f tag=v1.0.6
gh run watch
gh run view --log-failed       # xcodebuild errors on failure
```

`.github/workflows/ios-release.yml` runs on `macos-15` (Xcode 16.4): `npm ci` → version rewrite →
`ts:check`/`check:boundaries` → `npm run configure` (release) →
`scripts/restore-ios-signing.sh <app>` (imports the shared distribution cert into a temporary
keychain, installs that product's App Store profile, writes `ios/ExportOptions.plist`) → `pod install`
→ `xcodebuild archive` → `xcodebuild -exportArchive` → `codesign` verify (Apple Distribution) →
TestFlight (`apple-actions/upload-testflight-build@v5`, App Store Connect API) → GitHub Release.
Pass `-f upload=false` to skip the TestFlight upload (artifact/release only). Required secrets are in
`docs/RUNBOOKS/CI_PIPELINE.md` → "iOS / App Store" and `client/mobile/.env.ios`.

The version input (or `package.json`) sets `MARKETING_VERSION`; the build number is derived from the
semver (`1.0.6` → `10006`). `Info.plist` reads `$(MARKETING_VERSION)`/`$(CURRENT_PROJECT_VERSION)`,
so the bump flows into the submitted bundle. Bump the semver for each upload — App Store Connect
rejects a duplicate build number for the same marketing version.

Each product is a separate listing built from the same target via a build configuration:

| Product | Configuration | Bundle id | Firebase plist |
|---|---|---|---|
| Faazio | `Release` | `com.faazio.customer` | `GoogleService-Info.plist` (committed) |
| Delivery Partner | `Delivery-Release` | `com.faazio.deliverypartner` | `GoogleService-Info-Delivery.plist` (CI secret) |
| Seller Partner | `Seller-Release` | `com.faazio.sellerpartner` | `GoogleService-Info-Seller.plist` (CI secret) |

### Manual fallback (macOS + Xcode)

Requires macOS + Xcode; run `cd client/mobile && npm install && cd ios && pod install` first. Before
archiving a partner app: put its `GoogleService-Info-<App>.plist` in `ios/Faazio/` and run
`APP_VARIANT=delivery|seller npm run configure` (the bundle phase hard-fails otherwise). The
`Delivery-*` / `Seller-*` configurations bundle `index.delivery.js` / `index.seller.js` (set as
`ENTRY_FILE` by the build phase); customer configurations use `index.js`.

```bash
cd client/mobile
npm run ios                                    # debug build + Metro in simulator
# release: open ios/Faazio.xcworkspace, Product → Scheme → Edit Scheme → <App>-Release, then Archive
```

Upload via Xcode Organizer / Transporter; then fill App Store Connect metadata.
`ios/Faazio/Info.plist` declares only the usage strings the app actually triggers (camera and
location); no unused/generic permission strings.

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

### Razorpay customer payments (UPI + COD)

Migration `0066` (customer Razorpay link columns) must be applied. The customer rail reuses the base
`RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` (the ones already set in Render).
No merchant VPA env is used — reconciliation is by `razorpay_order_id` and the raw UPI intent `pa` is the
client-side default. With either key unset the customer rail is **disabled**: `POST /razorpay/customer/orders`
and `POST /webhooks/razorpay/payments` return `503 payments_disabled`, and the gateway never fabricates a
synthetic paid order. Set the keys before accepting live payments. Register the customer webhook in the
Razorpay dashboard at `https://api.faazio.com/webhooks/razorpay/payments` for `payment.captured`,
`payment.authorized` and `payment.failed`; routing back into the app also relies on the
`faazio://payment/callback` URL scheme (registered on Android + iOS).

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
# from the repo root — reads DATABASE_URL from server/gateway/.env (pgx, no psql/Docker):
server/supabase/apply-migration.sh server/supabase/migrations/0050_district_rls.sql   # each pending file
# or everything newer than the last applied:
server/supabase/apply-migration.sh --from 0050
```

Run **each pending** migration (numeric order) → then roll the Render deploy. Release order is
**DB first, gateway second**. Full command set + fresh-DB/seed flow:
`docs/RUNBOOKS/DATABASE_MIGRATIONS.md`.

## ✅ Release checklist

- [ ] `npm run ts:check` and `npm run check:boundaries` pass (both are CI steps).
- [ ] `versionCode` > the previous release (committed +1 bump, or derived from `-f version` semver — e.g. `1.0.4` → `10004`).
- [ ] Release keystore SHA-1/SHA-256 registered in Firebase for all three Android apps; Maps/Places keys restricted to the release SHA-1 for **customer + delivery** only (seller mounts no map — see "Register the release cert").
- [ ] `CERT_PINS` set and Firebase native config committed when `USE_GATEWAY=true` (release configure fails without them).
- [ ] Per-app GitHub secrets set: `KEYSTORE_BASE64_<APP>`, `KEYSTORE_PASS_<APP>`, `KEY_ALIAS_<APP>`, `ALIAS_PASS_<APP>` for each product being released (all keystores backed up).
- [ ] Release APK signed with the **release cert** (`CN=Faazio`), not the debug cert.
- [ ] `gh workflow run release-apk.yml` succeeded and the signed APK is on the GitHub Release.
- [ ] Portal (if deploying): `0032` + `0033` applied, `PORTAL_JWT_SECRET`/`PORTAL_PEPPER` set, a superadmin hash provisioned (`PORTAL_AUTH.md`).
- [ ] **Server/Render:** all `server/supabase/migrations/` files up to the latest are applied from a dev terminal (`DATABASE_MIGRATIONS.md` — Render never auto-applies); then the gateway deploy rolled.
- [ ] Push delivery: `FCM_PROJECT_ID` + `FCM_SERVICE_ACCOUNT_JSON` (server-side Firebase service-account key — a Render secret env var) set for the gateway's embedded FCM sender. See `FIREBASE_AUTH.md`.
- [ ] Seller splits: `0039` + `0040` applied; Route keys + webhook endpoint/secret set (or the `RAZORPAY_*` fallback used); `R2_PRIVATE_BUCKET` set.
- [ ] Customer payments: `0066` applied; Razorpay **customer** webhook `/webhooks/razorpay/payments` registered (`payment.captured/authorized/failed`).
- [ ] Release signed and smoke-tested on a device (R8 gate: Home → Cart → Checkout → Pharma).
- [ ] Store metadata / data-safety updated (see Google Play §4 answer sheet; delete-account URL + in-app flow verified).

### Expected build-time / size impact (CI workflow)

| Metric | Before | After (arm64-only + R8) |
|---|---|---|
| CI build time, APK-only (default) | ~43 min (cold) | ~18–26 min (cached) |
| CI build time, `include-aab=true` | ~43 min (cold) | ~18–26 min + the extra bundle task |
| GitHub APK download | universal 4-ABI, unminified | ~−50% (arm64-only, minified) |
| Dex size / cold start | unminified | smaller dex (R8) → faster cold start |
