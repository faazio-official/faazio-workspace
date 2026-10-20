# Troubleshooting Runbook

> Common build / runtime failures for the Faazio mobile app.

## 🔧 Device not found

```
adb devices            # must show "<id>  device"
```

- If the device is missing, enable **USB debugging** and re-authorize the computer.
- If it shows `unauthorized`, accept the RSA prompt on the phone.
- Set `ANDROID_HOME` (e.g. `export ANDROID_HOME=$HOME/Android/Sdk`) and ensure
  `platform-tools` is on `PATH`.

## 🔧 Metro / port 8081

- **"Port 8081 is being used by another process"** → a previous Metro is running.
  The debug app reuses it, or kill it:
  ```bash
  pkill -f "react-native start"   # or kill the pid on :8081
  ```
- **Stale bundle / weird UI** → clear Metro cache:
  ```bash
  npm run start -- --reset-cache
  ```
- **`npm run start` hangs forever at "Starting Metro Bundler" (no QR, :8081 never binds)** → the
  workspace is on an **NTFS3 mount** (`/dev/nvme0n1p5 ntfs3 /media/faizal-basha/Codespace`).
  The kernel ntfs3 driver deadlocks when several threads `readdir` the same tree concurrently,
  which is exactly what Metro's file-map crawl does with multiple workers. Fixed in
  `metro.config.js` with two knobs:
  - `config.maxWorkers = 1` — serializes the crawl.
  - `resolver.blockList` skips Gradle artifacts (`node_modules/*/android/build/`) that are
    never imported but hold ~26k files.
  Cold first build on NTFS is slow (~2 min); subsequent cached builds are fast. If a crawl was
  interrupted, re-run with `npm run start -- --reset-cache`.
  Long-term: hosting the repo on a native Linux filesystem (ext4) avoids the whole class of
  ntfs3 watcher/crawl issues.

## 🔧 "Faazio isn't responding" (ANR) or silent crashes

- **App frozen / ANR on launch** → the device is usually running an **old debug build** (a debug
  APK is un-optimized and ANR-prone). Reinstall a fresh **release** build from CI (never build
  locally — systemd-oomd kills Gradle):
  ```bash
  gh workflow run "Release APK"
  gh run watch && gh release download v<version> --pattern "*.apk" --clobber
  adb uninstall com.faazio.customer && adb install -r app-release.apk
  ```
- **Stuck on the splash / never advances** → startup (fonts/hydration) stalled. `App.tsx` now has a
  **splash failsafe** (auto-dismiss after 10 s) and **4 s hydration timeouts**, so a hanging native
  module no longer blocks launch. (The branded splash normally shows for a **minimum of 5 s**.)
  If it still hangs, `adb logcat -s ReactNativeJS` for `[Faazio:hydrate]`.
- **Crashes with no error shown** → release builds strip `console.*`; unhandled JS/render errors now
  surface via the global `ErrorUtils` handler (`[Faazio:global-error]` in dev). Add remote
  telemetry (Sentry/Crashlytics) for production visibility — tracked in `PENDING_WORK.md`.

## 🔧 "Something went wrong" error screen (Mart / Pharma sub-app)

An error thrown while a sub-app is mounting is caught by the boundary and shows
**"Something went wrong"**. Since release builds strip `console.*`, **read the thrown `message`
rendered on the error card** (plus the first stack frame in a dev build) — that is the signal.

- The **root** boundary (`scope="App"`, `AppNavigator`) wraps the whole navigator; the **scoped**
  `scope="SubApp"` boundary in `SubAppScreen` contains a Mart/Pharma-only failure so Home/Food keep
  working. Both offer **"Go to Home"** (resets navigation via `navigationRef`).
- For a **full stack immediately**, install a **debug build from CI** (`gh workflow run
  android-debug.yml`, then `adb install` + `npm run start`) — dev does **not** strip `console.*`,
  so the RedBox and `adb logcat -s ReactNativeJS` both show it. Do **not** build locally.
- Likely causes: an unknown `subAppId` (handler: "Unsupported sub-app" state, no crash), a bad
  `initialVendorStoreId` (guarded), or a release-only native/keep-rule gap (message mentions
  `requireNativeComponent` / `UIManager` / `Invariant Violation`).
- **Reinstall caveat:** a debug build and a release APK are signed differently. After installing a
  debug build, `adb uninstall com.faazio.customer` before installing a release APK (otherwise
  `INSTALL_FAILED_UPDATE_INCOMPATIBLE` / "package appears to be invalid").

## 🔧 Stale / wrong app icon after an update

- The launcher icon is baked into the APK at build time — it only changes on **reinstall**.
- If the icon is unchanged after `adb install`, the installed APK predates the icon assets, or the
  OS didn't see a version change. **Bump `versionCode`/`versionName`** in
  `android/app/build.gradle` (+ `package.json` `version`), rebuild, and reinstall.
- Icon source files: `src/assets/icon.png` (1024 launcher), `adaptive-icon.png` (1024 foreground,
  artwork in the 66% safe zone), `logo.png` (wide splash wordmark). Regenerate all three from the
  1254×1254 source artwork via `python3 scripts/regenerate-icons.py` (keep them distinct — they
  must **not** be byte-identical, or the adaptive mask/splash render incorrectly).

## 🔧 Gradle / native build failures

> **Rule: do not run Gradle locally on this machine.** Build in GitHub Actions
> (`gh workflow run android-debug.yml` for a debug artifact, `gh workflow run "Release APK"` for a
> signed release) and read errors with `gh run view --log-failed`. The diagnosis below is kept for
> reference / when forcing a build on a freed machine.

- **Native module changed (e.g. `react-native-vision-camera` added/updated)** → an APK built
  before the change will crash with a missing module error. Rebuild the app **in CI**
  (never locally):
  ```bash
  gh workflow run android-debug.yml
  gh run watch
  gh run download <run-id> -n faazio-debug-apk
  adb install -r app-debug.apk
  ```
  > Changing a permission string (`AndroidManifest.xml` or `Info.plist`
  > `NSLocationWhenInUseUsageDescription` — e.g. checkout live-address auto-fill) **also
  > requires a native rebuild** (CI debug build, as above) so the new prompt text is baked into the client.
- **`compileDebugKotlin FAILED` — `Module was compiled with an incompatible version of Kotlin`
  (`firebase-auth-*.jar`, metadata 2.4.0, expected 2.1.0)** → the Android Kotlin version is older
  than the Firebase/Kotlin metadata used by `@react-native-firebase/auth`. Keep
  `kotlinVersion = "2.4.0"` (and the explicit `kotlin-gradle-plugin:$kotlinVersion` classpath) in
  `android/build.gradle`; do not downgrade Firebase to work around it.
- **`compileDebugKotlin FAILED` — `Unresolved reference 'ReactNativeHostWrapper'`**
  → a generated `android/` project (or leftover generated files) is present. This repo is bare RN:
  `settings.gradle` must use `@react-native/gradle-plugin`, `MainApplication.kt` must use
  `DefaultReactHost`, and there must be no third-party Gradle plugins or autolinked module entries.
  If `android/` was overwritten by a prebuild/generator, restore it from git (`git checkout --
  android/`) — never regenerate it.
- **Native project corrupted / wrong package after a bad generator run** → restore the committed
  shell from git rather than patching it by hand:
  ```bash
  git checkout -- android/ ios/
  ```
  Then verify `namespace`/`applicationId` = `com.faazio.customer`, `versionCode`/`versionName` in
  `android/app/build.gradle`, and that `ios/Faazio/AppDelegate.swift` sets moduleName `main`.
- **NDK / CMake issues** → the project pins NDK `27.1.12297006` (see `android/build.gradle`).
  Install via Android Studio SDK Manager; confirm `ANDROID_HOME` points at the SDK.
- **Out of memory (OOM) on a memory-pressured laptop** → **lower** concurrent Gradle memory,
  do **not** raise it. The machine is out of RAM, so a bigger heap makes it worse. `android/`
  `gradle.properties` already caps this: `org.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=512m`,
  `org.gradle.workers.max=2`, `org.gradle.parallel=false`. Free RAM first (close Chrome/VS Code
  windows, or `sudo swapoff -a && sudo swapon -a` to flush exhausted swap).
  > **CI is tuned separately.** The release workflow writes `~/.gradle/gradle.properties`
  > (`-Xmx6144m`, `workers.max=4`, `parallel=true`) which **overrides** these laptop caps on the
  > GitHub runner only — the repo's `gradle.properties` intentionally stays laptop-capped.
- **`npm run android` / `./gradlew` exits 1 with no Gradle error text (empty output)** →
  **confirmed root cause (2026-09-12): `systemd-oomd` kills the Gradle processes when the
  user-session cgroup exceeds its memory-pressure threshold**. `oomctl dump` showed the
  entire `user@1000.service` slice (Chrome + VS Code + terminals + Gradle, ~9.6G) monitored
  at **50% pressure for 20s** (`DefaultMemoryPressureDurationSec=20s`), and swap limit 90%.
  The kernel OOM killer never fires (`/proc/vmstat` `oom_kill 0`) because systemd-oomd
  SIGKILLs the whole process group first — the daemon's last line reads `dispatching the
  build result: Success` followed by `EOFException`, i.e. the client died mid-build and the
  build produced nothing. Build attempts consistently died ~2 minutes in, detached or not,
  `--no-daemon` or not, any gradle.properties tuning. Diagnose:
  ```bash
  oomctl dump                       # Memory Pressure Monitored CGroups + current usage
  grep oom_kill /proc/vmstat        # 0 = kernel OOM never fired → it's systemd-oomd
  ls -t ~/.gradle/daemon/*/daemon-*.out.log | head -1   # EOFException right after "Success"
  ```
  Fix: free substantial RAM (close Chrome/VS Code windows; the aarvethu `next-server` +
  postgres leftovers from another project eat ~1.5G) or flush swap
  (`sudo swapoff -a && sudo swapon -a`), then retry — pressure must stay under 50% for the
  whole build. **Realistically: use the CI pipeline** (`gh workflow run "Release APK"` or
  `gh workflow run android-debug.yml`, see `docs/RUNBOOKS/CI_PIPELINE.md`) — CI has repeatedly
  built the same code successfully (release v1.0.2) while every local attempt on this machine
  failed under memory pressure.
  > **Gotcha for tooling/agents:** do NOT use `pkill -9 -f "GradleDaemon"` — the `-f` pattern
  > matches your own shell command line and kills your session. Kill by PID from
  > `ps -eo pid,args | grep "[G]radleDaemon"`.

## 🔧 Reanimated dev-mode crash: "set the key `current` … on an immutable/frozen object"

On **React 19.2 + RN 0.86 (New Architecture)** a dev-only crash can surface when mounting a
screen that uses `useAnimatedStyle` (e.g. the Home tab):

```
ERROR [Error: You attempted to set the key `current` with the value `undefined`
       on an object that is meant to be immutable and has been frozen.]
  at useAnimatedStyle.ts:597 (react-native-reanimated)
```

This is an upstream reanimated bug (issue #8454, still open) — reanimated deep-freezes the
`styleUpdaterContainer` shared object during render, then the hook's passive effect tries to
reassign `.current` and throws. It is **not** caused by app code and reproduces on a cold
reload, not just Fast Refresh.

**Fix** — a `patch-package` patch in `client/mobile/patches/react-native-reanimated+4.5.1.patch`
guards the mutation so it's skipped when the container is already frozen:

```diff
-      animatedUpdaterData.current.styleUpdaterContainer.current = fun;
+      const updaterContainer = animatedUpdaterData.current.styleUpdaterContainer;
+      if (updaterContainer && !Object.isFrozen(updaterContainer)) {
+        updaterContainer.current = fun;
+      }
```

The mapper (`startMapper`) still drives the animation, so behavior is unchanged. The patch is
re-applied automatically on `npm install` via the `postinstall: patch-package` script.

- **After editing the patch**, the native build must be rebuilt **in CI** so the JS source change
  is picked up: `gh workflow run android-debug.yml` → download artifact → `adb install -r`.
- **Quick verification** that Metro serves the patched code:
  ```bash
  curl -s "http://localhost:8081/index.bundle?platform=android&dev=true&minify=false" | grep -c "Object.isFrozen(updaterContainer)"   # expect >= 1
  ```

## 🔧 Header overlaps status bar / first content under the header

If a header slides under the OS status bar (clock/battery/cutout) or the first section of
content renders behind the header, the screen is using the wrong top inset.

**Convention:** always reserve top space with `useSafeAreaInsets().top` (the Home header,
`SubAppHeader` via `subAppHeaderH(topInset, compact, withRail?)`, and all `STATUS_BAR_INSET`
consumers now
do). **Never use `StatusBar.currentHeight`** — it is a static module constant that is `0` on iOS
and stale on Android edge-to-edge, so it reserves no real space on iOS.

- The Home header is a **fixed-height, transform-only collapsing overlay**: `headerOuter` is
  `position:absolute` with a static `height = expandedHeaderH(top)` (never animated) and the inner
  stack slides via `translateY`; the list is full-screen with
  `contentContainerStyle.paddingTop = expandedHeaderH(top)`. The inset-aware `collapseCap`
  (`expandedHeaderH - collapsedVisibleHeaderH`) slides the search bar to exactly `insets.top` at
  full collapse (the top block + rail fade out via UI-thread opacity curves, and the faded rail
  zone stops catching taps), and the list content starts flush below the header. If it
  regresses, check that `collapseCap` still subtracts `insets.top`, that the list's `paddingTop`
  equals `expandedHeaderH(top)`, and that the header overlay height is static (never animated).
- After changing inset code, verify on device: Home at rest (first section flush, no ghost
  overlap or gap), scroll-down collapse (search bar stops below the status bar), and iOS notch
  spacing.

## 🔧 Ghosting / artifacts under the collapsing Home header

The Home header is an **opaque overlay** (see `docs/architecture/mobile-app.md`), so scrolling
content passes behind it. Two causes produce the "broken pixels"/artifact look and are both
already fixed in code — if they regress, this is what to check:

- **Semi-transparent gradient bleed-through.** `HubGradient` previously used
  `<Stop stopOpacity={0.85}>` across the band, so ~15% of every scrolling pixel bled through the
  header and the compositor had to per-pixel-blend the list under the header every frame. All
  gradient stops must be `stopOpacity: 1` (the tail is `#f1f5f9`, identical to the list
  background). Keep the decorative circles.
- **Elevation inside a clipped + transformed + opacity-animated subtree.** The search bar must not
  use `shadow*`/`elevation` — the documented Android artifact trio RN #32078 / #25093 / #23090
  (clipped octagons, broken opacity+radius). It uses `borderWidth: 1` +
  `borderColor: rgba(0,0,0,0.05)` instead. Reintroducing elevation anywhere in the sliding/fading
  header will re-trigger these.

**Measure objectively (release only — debug exaggerates jank):** compare before/after a change
with the frame stats over a fling through the collapse zone + to the bottom:
```bash
adb shell dumpsys gfxinfo com.faazio.customer
```
Look at `Janky frames` % / 90th-percentile frame time. Don't judge smoothness on a debug
build (Reanimated is far slower in debug); use a **CI release** build.

## 🔧 Typecheck / boundary failures

- `npm run ts:check` — if it only fails with
  `TS5101 Option 'baseUrl' is deprecated …`, that's a **pre-existing** `tsconfig.json`
  deprecation (unrelated to your change). Verify your code with:
  ```bash
  npx tsc --ignoreDeprecations 6.0
  ```
- `npm run check:boundaries` fails → you imported another sub-app's internals. **Only
  `Home` may cross sub-apps.** Move the import to the sanctioned owner
  (shared primitive, theme, state, or `@data/*`), or route through Home.
- `npm run check:drillin` fails → a `MASTER_CATEGORIES` `searchQuery` resolves 0 vendors (the
  drill-in page would render "No vendors yet" with no ad carousel). Add/extend a mart/pharma
  product whose name/category/desc/attributes contain **every** query token (see
  `data/DATA_CONTROL.md` → "Drill-in coverage seeding").

## 🔧 Gateway / backend (Go) run failures

- `panic: chi: attempting to Mount() a handler on an existing path, '/'` → you used `r.Mount("/", …)`
  for a context. Contexts expose `Register(r)` and add routes to the **shared** router; only the
  composition root (`internal/server`) builds the router. See `server/gateway/README.md`.
- `go run ./tools/importlint` fails → a context imported a sibling context. Route the call through a
  `internal/contracts` interface injected at the composition root
  (`docs/architecture/monolith-breakdown.md` §2).
- `/health` shows `"db":false` / `"mongo":false` → the matching env var is unset
  (`DATABASE_URL`/`MONGO_URI`); the gateway starts without them for `/health`-only runs. Use
  `docker compose up --build` in `server/gateway/`, or set `.env` from `.env.example`.
- Search/detail returns `*_unavailable` → Postgres reachable but migrations/seed not applied. Apply
  `server/supabase/migrations/*.sql` then `server/supabase/seed/0001_seed.sql` (compose does this on
  first boot; for an existing volume, re-create it).
- Mongo `home feed unavailable` → `mongodb` not seeded. Run `server/supabase/seed/mongo/seed.js`
  (compose mounts it into `/docker-entrypoint-initdb.d`).

## 🔧 Partner Portal returns 503 on sign-in

A `503` on `/api/auth/portal/login` has three distinct origins (A/B/C) — the portal now preserves the
body `code` and shows distinct copy, and `GET /api/auth/portal/status` returns a one-call verdict.
Full triage table + commands: `docs/RUNBOOKS/PORTAL_AUTH.md` §0.

- **`not_configured` (A)** → the deployed build has no `NEXT_PUBLIC_GATEWAY_URL`. It is inlined at
  `next build`: set the Vercel env var and **redeploy**. Locally, copy `.env.example` → `.env.local`.
  `scripts/check-env.mjs` (`predev`/`prebuild`) warns/fails on this.
- **`gateway_unavailable` (B)** → `GET $GATEWAY/health` is down/unreachable (wrong origin, TLS,
  cold start, origin lock). Check the origin and Cloudflare tunnel, then retry.
- **`portal_auth_unavailable` (C)** → `PORTAL_JWT_SECRET` is empty on Render. Set it and roll the
  deploy; the boot log line `portal_auth=disabled reason=jwt_secret_empty` confirms it.
- **`portal_unavailable` (500, D)** → Postgres reachable but migrations `0032`/`0033` not applied
  (the boot log shows `portal_tables=missing|partial`). Apply them; for an existing compose volume
  `docker compose down -v` (dev only) or `psql -f 0033_portal_roles.sql`. `0034` is data-only
  (clears the superadmin forced-rotation flag) and can be applied separately.
- After C/D are fixed, a **valid** email still returns `401 invalid_credentials` until the account is
  provisioned (`PORTAL_AUTH.md` §2) — that is expected, not a failure.

## 🔧 401 on `/ads/events` or `/vendors/{id}/rating` (paid-ad KPIs / durable rating inert)

These two writes sit behind `auth.Require`. A configured app signs in with real Firebase phone OTP
(`firebaseAuth.ts`), so the Firebase ID token verifies on an `AUTH_DISABLED=false` gateway. A `401`
means the session is missing/expired or Firebase is unconfigured/misconfigured. Diagnose:

- **Configured build:** `google-services.json` / `GoogleService-Info.plist` must be present and the
  release `FIREBASE_PROJECT_ID` must match the token's project. A forced refresh with no native user
  clears the session and returns to Login (`GatewayClient.recoverSession`). Token failures are
  rarely `401` at the source: check `iss`/`aud` first (see `docs/RUNBOOKS/FIREBASE_AUTH.md`).
- **Dev build console:** `recordAdEvent` logs `[ads] impression not recorded (401, auth=…)`; a
  `auth=dev-bypass` result means the dev header is in play. `GatewayClient.authStatus()` returns
  `dev-bypass` / `enterprise` / `none`.
- **Dev without Firebase:** the app still falls back to a placeholder session (dev builds only); run
  the gateway with `AUTH_DISABLED=true`.
- **Local dev fix:** run the gateway with `AUTH_DISABLED=true` (`DEV_USER_ID=user-1`) and set
  `DEV_USER=user-1` in `client/mobile/.env.local` (dev builds only; re-run `npm run configure`/Metro). A production/release
  build never sends `X-Dev-User`, so do not expect the KPIs there.
- **Shopper impact:** none — local last-click attribution (`services/adsAttribution`) and the
  device-local vendor rating still work; the rating screen surfaces `signed-out`/`not-verified`
  inline instead of claiming a server write. See `client/mobile/PENDING_WORK.md` W49.

## 🔧 Scroll jank / slow first load

**Rule: judge performance on a release build, not dev.** Dev mode (Metro, debug build) exaggerates
jank and startup time. Verify before/after with a **CI release** build:
```bash
gh workflow run "Release APK"
```

Conventions that keep the Home feed smooth (see `docs/architecture/mobile-app.md`):
- **Never mirror scroll position into JS state.** Home reads `scrollY`/`viewportH` as Reanimated
  `SharedValue`s; `renderItem` stays a stable identity. If the feed starts hitch/scrolling again,
  check `FilterFeedSection` / `HomeView` for a new `setState` in the scroll handler or a new prop
  that changes `renderSection`/`renderItem` identity per frame.
- **Hot lists run on `Animated.FlatList` today** with flat-list tuning already applied; migrating
  to **FlashList v2** (`@shopify/flash-list`, recycling + scroll anchoring on by default) is a
  tracked follow-up in `PENDING_WORK.md`. Don't regress the existing tuning
  (`initialNumToRender`/`windowSize`/`maxToRenderPerBatch`) without a measured reason.
- **Network images use the shared `AppImage`** (RN `Image` with `resizeMode="cover"`, disk/HTTP
  cache) via `ProductCardBase` — never a raw per-component `Image` on the feed (raw pop-in,
  re-decode during scroll).
- **Non-initial routes are lazy-loaded** (`React.lazy` in `AppNavigator`/`MainTabs`) and fonts are
  trimmed + Android-gated (`useAppFonts`). If startup regresses, keep `Onboarding`/`Login`/
  `MainTabs`/`Home` eager and confirm no screen statically imported the removed font weights.
- **Discover-grid batch load** is edge-triggered on the UI thread (`useDerivedValue` + `runOnJS`)
  at ~60% of the visible grid, deferred with `requestAnimationFrame` so the 8-card mount doesn't
  land mid-fling, and the next batch's images are prefetched (`Image.prefetch` via `AppImage`). The
  header collapse is **1:1** with the finger (`DAMPING = 1.0` in `HomeView`) — don't reintroduce
  damping (it caused the "content outruns the finger" surge).
- **Header collapse is transform-only** (see the header-overlap section above) — never animate the
  header's `height` (a per-frame layout pass on the whole list is the source of the old lag +
  "violent jumping"). Don't reintroduce a `y <= 0` teleport in the scroll handler: rubber-band
  deltas already decay `clamp` smoothly to 0, and a hard `clamp = 0` slams the header open in one
  frame. If residual jitter persists on the New Architecture, the
  `preventShadowTreeCommitExhaustion` feature flag is enabled in `MainApplication.kt` (via
  `ReactNativeFeatureFlags.override`) — the Reanimated-documented fix for
  `useAnimatedScrollHandler` headers; keep it enabled and note it requires a native rebuild.

### Perf baseline harness (Phase 0)

Judge every perf change against a measured baseline, never by feel. On a **release** build:
- **Cold start → interactive:** stopwatch from launch to the Home feed being tappable.
- **Scroll jank:** after a scripted 10-swipe fling through the collapse zone + to the feed bottom:
  ```bash
  adb shell dumpsys gfxinfo com.faazio.customer   # Janky frames %, 95th-percentile frame time
  ```
- **Re-render count:** export a React DevTools Profiler session of a Home scroll; `FilterFeedSection`
  re-render count should be **0** during a pure scroll (only chip-switch/add feedback re-renders it).

If a change doesn't move its number (jank ≤ baseline ÷ 3, or cold-start ≥ 30% faster), revert it
instead of keeping the complexity.

## 🔧 Minified (R8) release build

Release CI builds now enable R8 (`minifyEnabled`) + resource shrinking. This is safe **only if**
you smoke-test the release APK on a device before trusting it — R8 keep-rule gaps surface at
runtime, not build time.

- **Install a minified release APK on a device:**
  ```bash
  cd /tmp/opencode
  gh release download v1.0.2 --repo FaizalBasha-123/faazio-workspace --pattern "*.apk" --clobber
  adb uninstall com.faazio.customer     # if a debug-signed install is present
  adb install -r app-release.apk
  ```
  Walk the core flows: **Home → Cart → Checkout → Pharma**. If something crashes that worked
  before minification, add a keep rule to the committed `android/app/proguard-rules.pro` and rebuild.
- **Retracing a minified crash** — release stack traces have obfuscated class/method names. Retrace
  with the run's `mapping.txt` (private Actions artifact `faazio-mapping-<run_id>` — never publish
  it, it defeats obfuscation):
  ```bash
  # Android SDK build-tools retrace
  retrace.sh <mapping.txt> <obfuscated-stacktrace.txt>
  ```
- **`mapping.txt` missing** → it is uploaded only when R8 runs; confirm the build used the
  minify flags (`-Pandroid.enableMinifyInReleaseBuilds=true`) and that the job isn't `--no-daemon`
  skipping minification (it won't; `assembleRelease` always runs R8 with minify on).
- **Build gets much slower (~+2–4 min) after enabling R8** → expected; size + obfuscation win
  outweighs it. If a memory-pressured **local** build OOMs under R8, use CI (it tunes the heap up
  to 6 G safely on the runner).

## 🔧 Release signing

- **Release APK installs as debug-signed / needs `adb install` only** → the `release` build type is
  not signed with the release keystore. In CI this should not happen (the workflow runs
  `scripts/restore-keystore.sh` before `./gradlew assembleRelease`). For a manual build, run
  that script first (see RELEASE.md).
- **"Store file not found"** → `keystore/keystore.properties` (`STORE_FILE`) points to a missing
  file. Confirm the keystore exists and the path is correct (relative to project root). In CI,
  ensure `KEYSTORE_BASE64` secret is set.
- **CI build fails on `restore-keystore.sh`** → the `KEYSTORE_BASE64`/`KEYSTORE_PASS`/`KEY_ALIAS`/
  `ALIAS_PASS` secrets are missing or wrong; verify with `gh secret list`.
- **"App not installed as package appears to be invalid" (with a Done button, app name in the
  header)** → the device already has a **different-signature** Faazio installed, almost always a
  **debug-signed** build (from earlier `npm run android` dev testing) that was never uninstalled.
  The release APK is signed with the release keystore (`CN=Faazio`); the debug build is signed
  with the debug keystore (`CN=Android Debug`) — a *different cert*, so Android refuses the update
  with this exact error. Verify the certs differ:
  ```bash
  keytool -printcert -jarfile faazio.apk | grep Owner   # release: CN=Faazio
  # prior debug install: CN=Android Debug
  ```
  **Fix (installer side):** uninstall the existing Faazio first, then install the release APK:
  ```bash
  adb uninstall com.faazio.customer
  adb install faazio.apk
  ```
  On the phone: Settings → Apps → Faazio → Uninstall, then open the release APK. The release APK
  itself is valid (v2-signed, minSdk 24 → installs on Android 7.0+); a v1/JAR signature is not
  required for minSdk ≥ 24 (AGP/apksigner skip it by design).
- **Release APK is signed with only v2 (no v1)** → this is **expected and correct** for
  `minSdkVersion 24` (Android 7.0+); v1 (JAR) signing is only needed for Android < 7.0. Do not try
  to force v1 — both AGP and `apksigner` intentionally omit it when minSdk ≥ 24, and v2-only APKs
  install fine on Android 7.0+.
