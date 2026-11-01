# CI Pipeline Runbook

> Build + release the Faazio mobile app entirely in GitHub Actions (no local machine needed).
> The build is driven through the `gh` CLI.

## 🧩 The one rule

**Never build on a local machine — neither the release APK nor a debug APK.** Whenever an Android
build is needed, run it through the CI pipeline via `gh`. Local `npm run android` /
`react-native run-android` / `./gradlew` is **forbidden**: the laptop's `systemd-oomd` SIGKILLs Gradle at
its 50% memory-pressure threshold (see `TROUBLESHOOTING.md` → "Gradle / native build failures") and
it wastes the user's RAM. Local `npm run start` (Metro) is fine — it is the JS bundler, not Gradle.

## 📐 Pipeline overview

Four workflows:

- [`.github/workflows/release-apk.yml`](../../.github/workflows/release-apk.yml) — signed release
  APK → GitHub Release. `app: customer|delivery|seller` picks the product; delivery/seller releases
  land on a `-delivery` / `-seller` tag and need `GOOGLE_SERVICES_DELIVERY_JSON` /
  `GOOGLE_SERVICES_SELLER_JSON`.
- [`.github/workflows/ios-release.yml`](../../.github/workflows/ios-release.yml) — signed release
  `.ipa` on `macos-15` → TestFlight (App Store Connect API) + GitHub Release. Also takes
  `app: customer|delivery|seller`; see "🍎 iOS release" below.
- [`.github/workflows/android-debug.yml`](../../.github/workflows/android-debug.yml) — debug APK →
  downloadable Actions artifact (for device testing with a local Metro). Also takes
  `app: customer|delivery|seller`.
- [`.github/workflows/server-gateway.yml`](../../.github/workflows/server-gateway.yml) — Go monolith
  `build` / `vet` / `test` / `importlint` with Postgres + Valkey service containers (integration
  tests run; they skip cleanly when the services are absent). Triggers on `server/**` changes.

```
you (gh CLI) ──► GitHub Actions
                    ├─ Checkout
                    ├─ Free disk space                   ← drop unused runner toolchains/SDK images
                    ├─ Setup Node 24 + JDK 21
                    ├─ gradle/actions/setup-gradle      ← caches ~/.gradle + build cache
                    ├─ Tune Gradle for CI runner         ← ~/.gradle overrides laptop caps
                    ├─ npm ci                        (postinstall: patch-package + configure.js)
                    ├─ Set version (manual override)      [release only]
                    ├─ restore-keystore.sh <app>     ← decode that product's keystore  [release only]
                    ├─ npm run ts:check + check:boundaries   ← both must pass
                    ├─ npm run configure             ← JS config + cert pins + Maps/Places keys
                    ├─ ./gradlew assemble<Customer|Delivery|Seller><Release|Debug> --no-daemon \
                    │    -PreactNativeArchitectures=... \
                    │    [-Pandroid.enableMinifyInReleaseBuilds=true \
                    │     -Pandroid.enableShrinkResourcesInReleaseBuilds=true]   [release only]
                    │    [+ bundle<App>Release only when include-aab=true]       [release only]
                    ├─ Upload APK artifact (+ AAB when include-aab=true)
                    ├─ Upload R8 mapping (faazio-<app>-mapping-<run_id>, private)      [release only]
                    └─ gh release create + upload --clobber                        [release only]
```

### Speed + size knobs (CI-only)

- **Gradle cache:** `gradle/actions/setup-gradle` caches Maven deps, wrapper dists, transform
  outputs, and the Gradle **build cache** (which lets unchanged tasks restore across runs).
- **CI Gradle tuning:** the "Tune Gradle for CI runner" step writes `~/.gradle/gradle.properties`
  (`-Xmx6144m`, `workers.max=4`, `parallel=true`, `caching=true`). `GRADLE_USER_HOME` **takes
  precedence** over the generated `android/gradle.properties`, so it lifts the laptop caps only on
  CI — the repo's `gradle.properties` stays laptop-capped by design (see TROUBLESHOOTING.md).
- **arm64-only build + R8:** `reactNativeArchitectures=arm64-v8a` and both minify/shrink
  flags are passed via `-P` (they read `android/app/build.gradle`'s `findProperty`). Minified
  builds emit `mapping.txt`, uploaded as a **private** artifact for crash retracing. Pass
  `-f include-aab=true` to also build and attach the Play-bound AAB (default is APK-only).
- **Disk headroom:** the "Free disk space" step removes unused runner payloads (`.NET`, GHC,
  Boost, Swift, emulator/system images) before Gradle starts. Without it the runner's root
  filesystem can fill mid-build and the job dies with `No space left on device`.
- **`concurrency: group: release-apk`** prevents two release builds from running at once.

- **`android/` + `ios/` are committed** (bare RN) and are the source of truth. CI builds them
  directly — there is no prebuild/regeneration step.
- **Signing is not committed.** Each product has its own keystore, stored only as GitHub secrets.
  `scripts/restore-keystore.sh <app>` decodes `KEYSTORE_BASE64_<APP>` → that app's store file and
  writes `keystore/keystore[-app].properties` from `KEYSTORE_PASS_<APP>`/`KEY_ALIAS_<APP>`/
  `ALIAS_PASS_<APP>`. `android/app/build.gradle` reads the matching file per flavor; a release build
  fails fast if it is missing. CI also runs `apksigner verify` and pins the APK signer certificate's
  SHA-256 **per app** (customer/delivery/seller — values in `RELEASE.md`). An unsigned APK, a
  debug-signed APK, or one signed with another app's keystore fails the build.

## 🔐 Secrets (set once, never committed)

Set on the repo with `gh secret set`:

| Secret | Value |
|---|---|
| `KEYSTORE_BASE64_<APP>` | `openssl base64 -A -in client/mobile/keystore/<app store file>` (single line, portable) |
| `KEYSTORE_PASS_<APP>` | value from that app's `keystore[-app].properties` |
| `KEY_ALIAS_<APP>` | value from that app's properties (`faazio` / `faazio-delivery` / `faazio-seller`) |
| `ALIAS_PASS_<APP>` | value from that app's properties |

`<APP>` = `CUSTOMER` / `DELIVERY` / `SELLER` (set all three; each release reads only its own).
`STORE_FILE_<APP>` is optional (defaults per app).

### iOS / App Store (set once, never committed)

One **shared** Apple Distribution certificate signs all three products; each product has its own
App Store provisioning profile. Values are the GitHub secrets/variables listed in
`client/mobile/.env.ios` and used by `ios-release.yml`.

| Secret / variable | Kind | Value |
|---|---|---|
| `APPSTORE_CERTIFICATE_BASE64` | secret | `base64 -i distribution.p12` (single line) |
| `APPSTORE_CERTIFICATE_PASSWORD` | secret | that `.p12` password |
| `APPSTORE_TEAM_ID` | variable (or secret) | 10-char Apple Developer Team ID |
| `APPSTORE_PROVISIONING_PROFILE_CUSTOMER` | secret | `base64 -i customer.mobileprovision` (App Store) |
| `APPSTORE_PROVISIONING_PROFILE_DELIVERY` | secret | `base64 -i delivery.mobileprovision` (`com.faazio.deliverypartner`) |
| `APPSTORE_PROVISIONING_PROFILE_SELLER` | secret | `base64 -i seller.mobileprovision` (`com.faazio.sellerpartner`) |
| `APPSTORE_ISSUER_ID` | variable (or secret) | App Store Connect API issuer ID |
| `APPSTORE_API_KEY_ID` | variable (or secret) | App Store Connect API key ID |
| `APPSTORE_API_PRIVATE_KEY` | secret | contents of `AuthKey_XXXXXXXXXX.p8` |
| `GOOGLE_SERVICE_INFO_DELIVERY_PLIST` | secret | `base64 -i GoogleService-Info-Delivery.plist` |
| `GOOGLE_SERVICE_INFO_SELLER_PLIST` | secret | `base64 -i GoogleService-Info-Seller.plist` |

`CERT_PINS` (already set for Android) is reused by the iOS release configure step; `GATEWAY_URL`
(default `https://api.faazio.com`), `WEB_PORTAL_URL` (variable, default `https://app.faazio.com`),
`GOOGLE_MAPS_API_KEY_IOS` and `GOOGLE_PLACES_API_KEY` are optional overrides.
`scripts/restore-ios-signing.sh <app>` imports the certificate into a temporary keychain, installs that
product's profile (Xcode 16 + legacy paths), and writes `ios/ExportOptions.plist` (manual signing,
`method: app-store-connect`). No fastlane.

### Env files (mobile)

`scripts/configure.js` layers, lowest → highest: the selected env file (Android is per-app —
`.env.android.customer` / `.env.android.delivery` / `.env.android.seller`, chosen by `APP_VARIANT`;
iOS is one `.env.ios`; each complete/standalone with the shared values duplicated) → `.env.local`
(gitignored) → process env. Both release workflows set `CONFIGURE_PLATFORM` (`android` / `ios`) plus
`APP_VARIANT`, and pass the same names as GitHub secrets, so the committed files are local defaults
only and **never affect a CI release**.

## 🚀 Trigger a release

```bash
cd client/mobile
gh workflow run "Release APK" -f version=1.0.2 -f tag=v1.0.2                    # APK only
gh workflow run "Release APK" -f version=1.0.2 -f tag=v1.0.2 -f include-aab=true  # APK + Play AAB
gh run watch              # wait for the green check
gh run view --log-failed  # if it fails, pull the Gradle error here
```

Add `-f include-aab=true` only for a Play Console upload — it adds the `bundle<App>Release` task and
attaches the `.aab`; the default dispatch produces the signed APK alone.

## 🍎 iOS release

Builds a release-signed `.ipa` on a GitHub-hosted `macos-15` runner (Xcode 16.4), uploads it to
TestFlight via the App Store Connect API, and attaches it to a GitHub Release. The committed `ios/`
Xcode project is the source of truth — no prebuild. See the "iOS / App Store" secrets table above.

```bash
gh workflow run ios-release.yml -f app=customer -f version=1.0.6 -f tag=v1.0.6
gh workflow run ios-release.yml -f app=delivery -f upload=false   # build + artifact only, no TestFlight
gh run watch
gh run view --log-failed                 # if it fails, pull the xcodebuild error here
```

Steps: `npm ci` → rewrite `package.json` + Xcode `MARKETING_VERSION`/`CURRENT_PROJECT_VERSION`
(and inject the partner Firebase plist) → `ts:check` + `check:boundaries` → `npm run configure`
(release) → `restore-ios-signing.sh <app>` → `pod install` → `xcodebuild archive` →
`xcodebuild -exportArchive` → `codesign` verify (must be an "Apple Distribution" authority) → upload
IPA artifact → TestFlight → `gh release upload --clobber`.

The version is the same single source of truth as Android: the input (or `package.json`) sets the
marketing version, and the build number is derived from the semver (`1.0.6` → `10006`). App Store
Connect rejects a duplicate build number for the same marketing version, so **bump the semver for
each upload**. Product → tag conventions match Android (`v<version>`, `v<version>-delivery`,
`v<version>-seller`).

## 🐞 Trigger a debug build (device testing)

Builds a debug APK in CI without touching local Gradle, then installs it for use with a local
Metro bundler (so ErrorBoundary messages / RedBox are visible, since dev does not strip
`console.*`):

```bash
gh workflow run android-debug.yml -f app=customer   # or -f app=delivery
gh run watch
gh run view --log-failed                           # build errors, if any
gh run download <run-id> -n faazio-customer-debug-apk   # -> app-customer-debug.apk
adb install -r app-customer-debug.apk
adb reverse tcp:8081 tcp:8081                       # then `npm run start` locally
```

The `delivery` product is a **separate app** (`com.faazio.deliverypartner`, "Faazio Delivery Partner");
it needs the partner `google-services.json` in the `GOOGLE_SERVICES_DELIVERY_JSON` secret. The workflow
sets `APP_VARIANT=delivery` and `ENTRY_FILE=index.delivery.js`, so Gradle bundles only the partner
root (the customer build uses `index.js`). `app: seller` is the Seller Partner app
(`com.faazio.sellerpartner`, "Faazio Seller Partner"); it needs `GOOGLE_SERVICES_SELLER_JSON` and
`ENTRY_FILE=index.seller.js`.

> A debug APK is signed with the shared **debug** keystore (`android/app/debug.keystore`,
> `CN=Android Debug`, SHA-256 `FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C`)
> — different from any product's release key. If a release build is installed, `adb uninstall
> com.faazio.customer` (or `com.faazio.deliverypartner` / `com.faazio.sellerpartner`) before
> installing it.

The signed APK lands on the GitHub Release at `<tag>` (e.g. `v1.0.2`). Because the publish step
uses `gh release upload --clobber`, re-running the same tag **replaces** the old APK.

### Inputs

| Input | Description |
|---|---|
| `version` | Overrides `package.json` `version` (e.g. `1.0.2`). Empty = keep package.json. |
| `tag` | Git tag for the release (e.g. `v1.0.2`). Empty = `v<version>`. |
| `prerelease` | `true` marks the release as a prerelease. |
| `include-aab` | `true` also builds and attaches the Play-bound AAB (`.aab`); default `false` (APK only). |

### Version bump

`package.json` `version` is the single source of truth. The workflow **always** rewrites
`android/app/build.gradle` `versionName` + `versionCode` from the resolved semver (the
`-f version` input when supplied, otherwise `package.json`), so the build never ships a stale
committed versionCode. A lower versionCode is a downgrade and `adb install`/Play reject it, so
**`versionCode` must increase every release** — bump the semver for each release.

- `-f version=<semver>` also rewrites `package.json` and derives `versionCode` (`1.0.4` → `10004`).
- Without `-f version`, the committed `package.json` version is used and `build.gradle` is aligned to it.

> Replacing an older **debug-signed** install with the release-signed APK will fail with
> `INSTALL_FAILED_UPDATE_INCOMPATIBLE` — `adb uninstall com.faazio.customer` first (clears local
> data), then `adb install -r`.

## 📲 Install the release APK on a device

The published APK is a static release build — it does **not** hot-reload. To install it:

```bash
cd /tmp/opencode
gh release download v1.0.2 --repo FaizalBasha-123/faazio-workspace --pattern "app-customer-release.apk" --clobber
adb install -r app-customer-release.apk   # flavor-named: app-delivery-release.apk / app-seller-release.apk
```

> The release APK is signed with the **release** keystore. If a **debug**-signed Faazio is
> already installed, `adb install -r` fails with a signature mismatch — uninstall it first
> (`adb uninstall com.faazio.customer`, which clears its data).

## 🧑‍💻 Dev vs CI — when to use which

| Need | Command |
|---|---|
| Instant preview / hot reload on code change | `npm run start` + installed debug APK (Metro) |
| **Debug APK for device testing** (no local Gradle) | `gh workflow run android-debug.yml -f app=customer\|delivery` → `gh run download` |
| **Ship / replace a release APK** | `gh workflow run "Release APK" …` |
| Download the latest release APK | `gh release download … --pattern "*.apk"` |

> **Never** `npm run android` / `react-native run-android` / `./gradlew` locally — CI only (memory).

## ⚠️ Failure triage

- `npm ci` fails on `patch-package` → a stale patch references a removed package. Remove the
  orphan `patches/<pkg>.patch` (e.g. the old `react-native-skia` one).
- `restore-keystore.sh` fails → the `_<APP>` `KEYSTORE_BASE64`/`KEYSTORE_PASS`/`KEY_ALIAS`/`ALIAS_PASS`
  secrets are missing or wrong (`gh secret list`).
- **`Typecheck` fails with "Seller builds require WEB_PORTAL_URL"** → `configure.js` runs in the
  Typecheck step too, and a seller build needs a portal origin. Both workflows pass `WEB_PORTAL_URL`
  (falling back to `https://app.faazio.com`) plus `GATEWAY_URL` in that step; if you renamed the
  secret/variable, update the Typecheck step as well as the config step.
- "missing release keystore properties for: …" → run `scripts/restore-keystore.sh <app>` (release) or
  create the gitignored `keystore/keystore[-app].properties` locally.
- "Store file not found" → `STORE_FILE`/keystore path mismatch in that app's `keystore[-app].properties`.
- "release APK is not signed / not signed with a Faazio cert" → the per-app signing config was not
  applied; check the variant hook in `android/app/build.gradle` and the `KEY_ALIAS_<APP>` secret.
- **R8/minify build fails** (native `R8: ...` errors, or the APK crashes at runtime) → check the
  generated `android/app/proguard-rules.pro` and add keep rules; then the smoke-test gate in
  `RELEASE.md` is the runtime check. Minified stack traces must be retraced with `mapping.txt`
  (see TROUBLESHOOTING.md → "Retracing a minified crash").
- **iOS `restore-ios-signing.sh` fails** → the `APPSTORE_CERTIFICATE_BASE64` /
  `APPSTORE_CERTIFICATE_PASSWORD` / `APPSTORE_TEAM_ID` / `APPSTORE_PROVISIONING_PROFILE_<APP>`
  secrets are missing or wrong (`gh secret list`); the profile must be an **App Store** profile for
  that product's bundle id.
- **iOS archive/export fails with a signing error** → the profile's bundle id must match the built
  configuration (`com.faazio.customer` / `com.faazio.deliverypartner` / `com.faazio.sellerpartner`),
  and `APPSTORE_TEAM_ID` must be the team that owns both the certificate and the profile.
- **TestFlight upload fails** → check `APPSTORE_ISSUER_ID`/`APPSTORE_API_KEY_ID` (variables) and
  `APPSTORE_API_PRIVATE_KEY` (the full `.p8` contents). The API key needs the App Manager role.
