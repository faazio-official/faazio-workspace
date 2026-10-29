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

Three workflows:

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

```
you (gh CLI) ──► GitHub Actions
                    ├─ Checkout
                    ├─ Free disk space                   ← drop unused runner toolchains/SDK images
                    ├─ Setup Node 24 + JDK 21
                    ├─ gradle/actions/setup-gradle      ← caches ~/.gradle + build cache
                    ├─ Tune Gradle for CI runner         ← ~/.gradle overrides laptop caps
                    ├─ npm ci                        (postinstall: patch-package + configure.js)
                    ├─ Set version (manual override)      [release only]
                    ├─ restore-keystore.sh           ← decode keystore from secrets  [release only]
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
- **Signing is not committed.** The keystore lives only as GitHub secrets.
  `scripts/restore-keystore.sh` decodes `KEYSTORE_BASE64` → `keystore/faazio-release.keystore`
  and writes `keystore/keystore.properties` from `KEYSTORE_PASS`/`KEY_ALIAS`/`ALIAS_PASS`.
  `android/app/build.gradle` reads that file directly; a release build fails fast if it is missing.

## 🔐 Secrets (set once, never committed)

Set on the repo with `gh secret set`:

| Secret | Value |
|---|---|
| `KEYSTORE_BASE64` | `base64 -w0 client/mobile/keystore/faazio-release.keystore` |
| `KEYSTORE_PASS` | value from `keystore/keystore.properties` |
| `KEY_ALIAS` | value from `keystore/keystore.properties` |
| `ALIAS_PASS` | value from `keystore/keystore.properties` |

`STORE_FILE` is optional (defaults to `faazio-release.keystore`).

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

> A debug APK is signed with the CI runner's **debug** keystore — different from the release key.
> If a release build is installed, `adb uninstall com.faazio.customer` (or `com.faazio.deliverypartner`
> / `com.faazio.sellerpartner`) before installing it.

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

You manage **both** `package.json` `version` and `android/app/build.gradle` `versionCode`/
`versionName`. A vc-1 APK is a downgrade and `adb install` fails with
`INSTALL_FAILED_VERSION_DOWNGRADE`. Rule: **`versionCode` must increase every release**.

- Passing `-f version=<semver>` makes the workflow derive `versionCode` deterministically
  (`1.0.4` → `10004`) and rewrite `versionName` + `package.json` — no manual bump needed.
- Without `-f version`, bump `versionCode` (+1) and `versionName` in `build.gradle` yourself.

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
- `restore-keystore.sh` fails → `KEYSTORE_BASE64`/`KEYSTORE_PASS`/`KEY_ALIAS`/`ALIAS_PASS` secrets
  are missing or wrong (`gh secret list`).
- "keystore/keystore.properties not found" → run `scripts/restore-keystore.sh` (release) or create
  the gitignored file locally.
- "Store file not found" → `STORE_FILE`/keystore path mismatch in `keystore.properties`.
- **R8/minify build fails** (native `R8: ...` errors, or the APK crashes at runtime) → check the
  generated `android/app/proguard-rules.pro` and add keep rules; then the smoke-test gate in
  `RELEASE.md` is the runtime check. Minified stack traces must be retraced with `mapping.txt`
  (see TROUBLESHOOTING.md → "Retracing a minified crash").
