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

Three active GitHub Actions workflows plus one Codemagic workflow:

- [`.github/workflows/release-apk.yml`](../../.github/workflows/release-apk.yml) — signed release
  APK → GitHub Release. `app: customer|delivery|seller` picks the product; delivery/seller releases
  land on a `-delivery` / `-seller` tag and need `GOOGLE_SERVICES_DELIVERY_JSON` /
  `GOOGLE_SERVICES_SELLER_JSON`.
- [`.github/workflows/android-debug.yml`](../../.github/workflows/android-debug.yml) — debug APK →
  downloadable Actions artifact (for device testing with a local Metro). Also takes
  `app: customer|delivery|seller`.
- [`.github/workflows/server-gateway.yml`](../../.github/workflows/server-gateway.yml) — Go monolith
  `build` / `vet` / `test` / `importlint` with Postgres + Valkey service containers (integration
  tests run; they skip cleanly when the services are absent). Triggers on `server/**` changes.
- [`codemagic.yaml`](../../codemagic.yaml) (repo root) — signed release `.ipa` for the **customer
  app** on Codemagic (macOS M2, Xcode 26.3) → TestFlight. Started manually from the Codemagic UI;
  the delivery/seller partner apps are Android/Play releases, not iOS (see "🍎 iOS release" below).
  [`.github/workflows/ios-release.yml`](../../.github/workflows/ios-release.yml) is **disabled**
  (`gh workflow disable "Release iOS"`) and kept only for history/rollback.

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
  SHA-256 **per app** (delivery/seller — values in `RELEASE.md`). An unsigned APK, a
  debug-signed APK, or one signed with another app's keystore fails the build. The **customer
  upload key was purged on 2026-11-06**; customer release builds stay blocked until it is reset in
  Play Console and the `_CUSTOMER` secrets are re-provisioned.

## 🔐 Secrets (set once, never committed)

Set on the repo with `gh secret set`:

| Secret | Value |
|---|---|
| `KEYSTORE_BASE64_<APP>` | `openssl base64 -A -in client/mobile/keystore/<app store file>` (single line, portable) |
| `KEYSTORE_PASS_<APP>` | value from that app's `keystore[-app].properties` |
| `KEY_ALIAS_<APP>` | value from that app's properties (`faazio` / `faazio-delivery` / `faazio-seller`) |
| `ALIAS_PASS_<APP>` | value from that app's properties |

`<APP>` = `CUSTOMER` / `DELIVERY` / `SELLER` (each release reads only its own). `CUSTOMER` is
currently **unset** (upload key purged 2026-11-06) — reset it in Play Console and re-add the four
`_CUSTOMER` secrets before the next customer release. `STORE_FILE_<APP>` is optional (defaults per app).

### iOS / App Store (customer only — set once, never committed)

The **customer app** (`com.faazio.customer`) is the only iOS/App Store release; delivery/seller are
Android/Play only, so no partner iOS profile or Firebase plist secret is needed. These values live in
the Codemagic environment variable group `ios app` and are consumed by
[`codemagic.yaml`](../../codemagic.yaml).

| Secret / variable | Kind | Value |
|---|---|---|
| `APPSTORE_CERTIFICATE_BASE64` | secret | `base64 -w0 faazio-customer.p12` (single line) |
| `APPSTORE_CERTIFICATE_PASSWORD` | secret | that `.p12` password |
| `APPSTORE_TEAM_ID` | plain | 10-char Apple Developer Team ID |
| `APPSTORE_PROVISIONING_PROFILE_CUSTOMER` | secret | `base64 -w0 customer.mobileprovision` (App Store, Push-enabled) |
| `APPSTORE_ISSUER_ID` | plain | App Store Connect API issuer ID |
| `APPSTORE_API_KEY_ID` | plain | App Store Connect API key ID |
| `APPSTORE_API_PRIVATE_KEY` | secret | contents of `AuthKey_XXXXXXXXXX.p8` |
| `CERT_PINS` | plain | comma-separated base64 SHA-256 SPKI pins (from `scripts/cert-pins.sh`) |
| `GOOGLE_MAPS_API_KEY_IOS` | secret | restricted iOS Maps key |
| `GOOGLE_PLACES_API_KEY` | secret | Places API (New) key for address autocomplete |

The disabled GitHub workflow also references `APPSTORE_PROVISIONING_PROFILE_DELIVERY` / `_SELLER`
and `GOOGLE_SERVICE_INFO_DELIVERY_PLIST` / `_SELLER_PLIST`, but these are only read by the unused
`delivery` / `seller` code paths. Codemagic only builds the customer app.

📖 The full step-by-step UI workflow for creating and downloading this `.p8` key (including the "App Manager" role choice and the one-time download warning) is on the dedicated runbook **`docs/RUNBOOKS/APPSTORE_API_KEY.md`**.

`GATEWAY_URL`, `WEB_PORTAL_URL`, `USE_GATEWAY`, `STRICT` and `USE_FIREBASE_AUTH` are set in
`codemagic.yaml`; the group supplies the certificate/profile, App Store Connect key, certificate
pins and Google keys. `REQUIRE_CERT_PINS=1` makes a missing pin set fatal.
`scripts/restore-ios-signing.sh customer` imports the certificate (leaf + private key) into a
temporary keychain, adds the Apple WWDR G3 intermediate, verifies a valid `Apple Distribution`
identity, installs the profile (Xcode 26 + legacy paths), and writes `ios/ExportOptions.plist`
(manual signing, `method: app-store-connect`). No fastlane.

### Env files (mobile)

`scripts/configure.js` layers, lowest → highest: the selected env file (Android is per-app —
`.env.android.customer` / `.env.android.delivery` / `.env.android.seller`, chosen by `APP_VARIANT`;
iOS is one `.env.ios`; these are local/gitignored and complete/standalone with the shared values
duplicated) → `.env.local` (gitignored) → process env. CI does not rely on those files: the release
workflows set `CONFIGURE_PLATFORM`, `APP_VARIANT` and the required values as environment
variables/secrets, so the local defaults **never affect a CI release**.

### 🚫 iOS provisioning profile — local macOS setup

The App Store provisioning profile is **not a repo file**. It is created in the Apple Developer Console and installed **only on your local Mac** (or via CI as a base64-encoded Codemagic environment variable).

#### Required local file placement (Xcode 26 with `CODE_SIGN_STYLE=Manual`)

The `.mobileprovision` file **must** exist at one of these paths on the Mac that runs `xcodebuild`:

| Path | Priority |
|------|----------|
| `~/Library/Developer/Xcode/UserData/Provisioning Profiles/` | ✅ Primary (Xcode 26) |
| `~/Library/MobileDevice/Provisioning Profiles/` | ⚠️ Legacy fallback (Xcode ≤ 15) |

**Workflow:**
1. Create an **App Store** provisioning profile for `com.faazio.customer` in Apple Developer Console (not Development, not Ad Hoc)
2. Download `Faazio Customer AppStore.mobileprovision` (or equivalent)
3. Install it to `~/Library/Developer/Xcode/UserData/Provisioning Profiles/` (or the legacy path)
4. Restart Xcode or run `xcodebuild` fresh — the profile is discovered by its embedded UUID

**CRITICAL: The `.mobileprovision` file lives ONLY on the local Mac or as a CI secret. It is never committed to the repo.**

#### Required Codemagic environment variable

Codemagic (`codemagic.yaml` → `scripts/restore-ios-signing.sh customer`) reads the profile as a
base64 secret in the `ios app` group:

```bash
# On a Mac with the .mobileprovision file:
base64 -i <path-to-mobileprovision> | pbcopy   # copy base64 to clipboard
# Then in Codemagic: App settings → Environment variables → group ios app
#   Name: APPSTORE_PROVISIONING_PROFILE_CUSTOMER
#   Value: <the base64 string you copied>
#   Secret: checked
```

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

## 🍎 iOS release (customer only — Codemagic)

Builds a release-signed `.ipa` for the **customer app** on Codemagic (macOS M2, Xcode 26.3) and
uploads it to App Store Connect, where it appears under **TestFlight → Builds**. The committed
`ios/` Xcode project is the source of truth — no prebuild. Delivery/seller have no planned iOS
release (Android/Play only). The GitHub `ios-release.yml` workflow is disabled; see
`docs/RUNBOOKS/IOS_RELEASE_WITHOUT_MACOS.md` for the full no-Mac runbook.

**Trigger it from the Codemagic UI:**

1. Open the Faazio application → **Start new build**.
2. Select branch `main` and workflow **iOS Customer Release**.
3. Optionally enter `version` (blank uses `package.json`), then start the build.

Steps in [`codemagic.yaml`](../../codemagic.yaml): `npm ci` → `ts:check` + `check:boundaries` +
`check:ui` → rewrite `package.json` + Xcode `MARKETING_VERSION`/`CURRENT_PROJECT_VERSION` →
`npm run configure` (release) → `pod install` → `xcodebuild archive` (unsigned) →
`restore-ios-signing.sh customer` + `xcodebuild -exportArchive` (same step, so the temporary keychain
and profile are live for the export) → `codesign` verify (must be an "Apple
Distribution" authority) → App Store Connect upload. iOS builds do **not** create a GitHub Release.

### 🍎 iOS Release from Linux (no macOS needed)

Codemagic builds on Apple silicon in the cloud; you start builds and submit for review from a
browser. No local Mac is required at any step.

**Prerequisites** — create the Codemagic environment variable group `ios app` with these
names (App settings → Environment variables; mark the rows listed as secret **Secret**):

| Variable | Kind | Value |
|---|---|---|
| `APPSTORE_CERTIFICATE_BASE64` | secret | base64 of the shared distribution `.p12` |
| `APPSTORE_CERTIFICATE_PASSWORD` | secret | that `.p12` password |
| `APPSTORE_PROVISIONING_PROFILE_CUSTOMER` | secret | base64 App Store `.mobileprovision` (`com.faazio.customer`, Push-enabled) |
| `APPSTORE_API_PRIVATE_KEY` | secret | contents of the App Store Connect `AuthKey_*.p8` |
| `APPSTORE_TEAM_ID` | plain | 10-char Apple Developer Team ID |
| `APPSTORE_ISSUER_ID` | plain | App Store Connect API issuer ID |
| `APPSTORE_API_KEY_ID` | plain | App Store Connect API key ID |
| `CERT_PINS` | plain | comma-separated base64 SHA-256 SPKI pins (from `scripts/cert-pins.sh`) |
| `GOOGLE_MAPS_API_KEY_IOS` | secret | restricted iOS Maps key |
| `GOOGLE_PLACES_API_KEY` | secret | Places API (New) key |

The gateway URL, portal URL, `USE_GATEWAY`, `STRICT` and `USE_FIREBASE_AUTH` are set in
`codemagic.yaml`; the group supplies the certificate/profile, App Store Connect key, pins and Google
keys. Do not rely on the local `client/mobile/.env.ios` file — it is gitignored and absent on the
Codemagic build machine.

**What happens after the build succeeds:**

The build appears in App Store Connect → TestFlight → Builds. You then submit for review from the
website (App Store → Add Build). Inviting TestFlight testers is optional — you can submit the
Codemagic build directly to App Store review. Every successful build uploads automatically; beta
review / App Store submission stays manual.

The build number is a UTC timestamp (`YYYYMMDDHHmm`) generated on every run, so each upload is
strictly higher than the last one — including a rebuild of the same marketing version. App Store
Connect rejects a build number that is not higher than the previously uploaded build, so never
hardcode it.

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

> A debug APK is signed with that product's own **debug** keystore (`android/app/debug.keystore`
> for customer, `debug-delivery.keystore`, `debug-seller.keystore`; all `CN=Android Debug`) —
> different from any product's release key. Digests: see `docs/RUNBOOKS/SIGNING_FINGERPRINTS.md`
> §2–§4 (gitignored, local copy only). If a release build is
> installed, `adb uninstall com.faazio.customer` (or `com.faazio.deliverypartner` /
> `com.faazio.sellerpartner`) before installing it.

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
  secrets are missing or wrong (`gh secret list`). For `customer` this is expected after the
  2026-11-06 purge: reset the upload key in Play Console and re-add the `_CUSTOMER` secrets.
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
  `APPSTORE_CERTIFICATE_PASSWORD` / `APPSTORE_TEAM_ID` / `APPSTORE_PROVISIONING_PROFILE_CUSTOMER`
  variables are missing or wrong (Codemagic → App settings → Environment variables → group
  `ios app`); the profile must be an **App Store** profile for `com.faazio.customer`.
- **iOS archive/export fails with a signing error** → the profile's bundle id must match the built
  configuration (`com.faazio.customer`), and `APPSTORE_TEAM_ID` must be the team that owns both the
  certificate and the profile.
- **Codemagic App Store Connect upload fails** → check `APPSTORE_ISSUER_ID`/`APPSTORE_API_KEY_ID`
  and `APPSTORE_API_PRIVATE_KEY` (the full `.p8` contents). The API key needs the App Manager role.
