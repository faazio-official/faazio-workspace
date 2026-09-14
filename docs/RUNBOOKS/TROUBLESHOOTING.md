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

- **"Port 8081 is being used by another process"** → a previous `expo start` is running.
  `expo run:android` reuses it, or kill it:
  ```bash
  pkill -f "expo start"        # or kill the pid on :8081
  ```
- **Stale bundle / weird UI** → clear Metro cache:
  ```bash
  npx expo start --clear
  ```
- **`expo start` crashes with `ERROR ... installing React Native DevTools ... Invalid argument (22)`**
  (a fatal zygote/dotslash crash that kills Metro before it binds :8081) → this is the known
  standalone-fusebox-shell bug (see react-native#54906). It is fixed project-wide by a
  `patch-package` patch that disables the standalone shell:
  `patches/expo++@expo+cli+57.0.22.patch`. Re-apply after a clean install:
  ```bash
  cd client/mobile
  npm run postinstall    # applies patches/expo++@expo+cli+57.0.22.patch
  ```
- **`expo start` hangs forever at "Starting Metro Bundler" (no QR, :8081 never binds)** → the
  workspace is on an **NTFS3 mount** (`/dev/nvme0n1p5 ntfs3 /media/faizal-basha/Codespace`).
  The kernel ntfs3 driver deadlocks when several threads `readdir` the same tree concurrently,
  which is exactly what Metro's file-map crawl does with multiple workers. Fixed in
  `metro.config.js` with two knobs:
  - `config.maxWorkers = 1` — serializes the crawl (see `metro:instantiate ... workers: 1`
    in `.expo/dev/logs/start.log`).
  - `resolver.blockList` skips Gradle artifacts (`node_modules/*/android/build/`) that are
    never imported but hold ~26k files.
  Cold first build on NTFS is slow (~2 min); subsequent cached builds are fast. If a crawl was
  interrupted, re-run with `npx expo start --clear`.
  Long-term: hosting the repo on a native Linux filesystem (ext4) avoids the whole class of
  ntfs3 watcher/crawl issues.

## 🔧 "Faazio isn't responding" (ANR) or silent crashes

- **App frozen / ANR on launch** → the device is usually running an **old debug build** (a debug
  APK is un-optimized and ANR-prone). Reinstall a fresh **release** build:
  ```bash
  cd client/mobile
  npm run android -- --variant release      # or ./gradlew -p android assembleRelease then adb install
  ```
- **Stuck on the splash / never advances** → startup (fonts/hydration) stalled. `App.tsx` now has a
  **splash failsafe** (auto-dismiss after 8 s) and **4 s hydration timeouts**, so a hanging native
  module no longer blocks launch. If it still hangs, `adb logcat -s ReactNativeJS` for `[Faazio:hydrate]`.
- **Crashes with no error shown** → release builds strip `console.*`; unhandled JS/render errors now
  surface via the global `ErrorUtils` handler (`[Faazio:global-error]` in dev). Add remote
  telemetry (Sentry/Crashlytics) for production visibility — tracked in `PENDING_WORK.md`.

## 🔧 Stale / wrong app icon after an update

- The launcher icon is baked into the APK at build time — it only changes on **reinstall**.
- If the icon is unchanged after `adb install`, the installed APK predates the icon assets, or the
  OS didn't see a version change. **Bump `versionCode`/`versionName`** in
  `android/app/build.gradle` (+ `app.json` `version`), rebuild, and reinstall.
- Icon source files: `src/assets/icon.png` (1024 launcher), `adaptive-icon.png` (1024 foreground,
  artwork in the 66% safe zone), `faazio-logo.png` (400 splash). Regenerate all three from the
  1254×1254 source artwork via `python3 scripts/regenerate-icons.py` (keep them distinct — they
  must **not** be byte-identical, or the adaptive mask/splash render incorrectly).

## 🔧 Gradle / native build failures

- **Native module changed (e.g. `expo-location` added/updated)** → a dev client built
  before the change will crash with a missing module error. Rebuild the dev client:
  ```bash
  cd client/mobile && npm run android
  ```
- **`compileDebugKotlin FAILED` — `Unresolved reference 'ReactNativeHostWrapper'`**
  → the generated `android/` project is **stale** vs the installed Expo SDK. Regenerate:
  ```bash
  cd client/mobile
  npx expo prebuild --clean
  ```
  > This wipes the gitignored `android/` folder and rewrites it for the current SDK. Everything
  > below is **local-only and must be re-applied after `prebuild --clean`**: (1) release signing
  > (`scripts/configure-release-signing.sh` — CI does this automatically), (2) the memory caps in
  > `gradle.properties` (`-Xmx2048m`, `workers.max=2`, `parallel=false`), (3)
  > `android/local.properties` (`sdk.dir`), (4) the Gradle wrapper version — Expo may generate a
  > newer Gradle (e.g. 9.3.1) that fails with `The settings are not yet available for build`;
  > pin back to 8.14.3 in `gradle/wrapper/gradle-wrapper.properties`.
- **Interrupted `expo prebuild` leaves `android/` broken with template defaults** → if prebuild
  is killed mid-run (e.g. a shell timeout), the regenerated `android/` may keep Expo template
  values instead of `app.json`: `com.helloworld` package, `versionCode 1`/`"1.0"`, Gradle 9.3.1
  wrapper. Symptoms: `The settings are not yet available for build`, or an APK with the wrong
  package. Fix: verify `app/build.gradle` (`namespace`/`applicationId` = `com.faazio.customer`,
  `versionCode`/`versionName` from `app.json`), `app/src/main/java/com/faazio/*` `package`
  lines, and the wrapper version — or re-run prebuild to completion in a detached shell:
  `setsid npx expo prebuild --clean --platform android > /tmp/prebuild.log 2>&1 &`
- **NDK / CMake issues** → the project needs a recent NDK (Expo SDK 57 pins NDK 27.1).
  Install via Android Studio SDK Manager; confirm `ANDROID_HOME` points at the SDK.
- **Out of memory (OOM) on a memory-pressured laptop** → **lower** concurrent Gradle memory,
  do **not** raise it. The machine is out of RAM, so a bigger heap makes it worse. `android/`
  `gradle.properties` already caps this: `org.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=512m`,
  `org.gradle.workers.max=2`, `org.gradle.parallel=false`. Free RAM first (close Chrome/VS Code
  windows, or `sudo swapoff -a && sudo swapon -a` to flush exhausted swap). These `android/` edits
  are wiped by `expo prebuild --clean` — re-apply after regenerating.
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
  whole build. **Realistically: use the CI pipeline** (`gh workflow run "Release APK"`,
  see `docs/RUNBOOKS/CI_PIPELINE.md`) — CI has repeatedly built the same code successfully
  (release v1.0.2) while every local attempt on this machine failed under memory pressure.
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

- **After editing the patch**, the native dev build must be rebuilt so the JS source change is
  picked up: `cd client/mobile && npm run android`.
- **Quick verification** that Metro serves the patched code:
  ```bash
  curl -s "http://localhost:8081/node_modules/expo/AppEntry.bundle?platform=android&dev=true&minify=false&app=com.faazio.customer&lazy=true" | grep -c "Object.isFrozen(updaterContainer)"   # expect >= 1
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
`npm run android` build (Reanimated is far slower in debug).

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

## 🔧 Scroll jank / slow first load

**Rule: judge performance on a release build, not dev.** Dev mode (Metro, `expo run:android`
debug) exaggerates jank and startup time. Verify before/after with:
```bash
npx expo run:android --variant release
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
- **Network images use `expo-image`** (`contentFit="cover"`, `cachePolicy="memory-disk"`,
  `transition`) via the shared `ProductCardBase` — never plain RN `Image` on the feed (no cache
  control, raw pop-in, re-decode during scroll).
- **Non-initial routes are lazy-loaded** (`React.lazy` in `AppNavigator`/`MainTabs`) and fonts are
  trimmed + Android-gated (`useAppFonts`). If startup regresses, keep `Onboarding`/`Login`/
  `MainTabs`/`Home` eager and confirm no screen statically imported the removed font weights.
- **Discover-grid batch load** is edge-triggered on the UI thread (`useDerivedValue` + `runOnJS`)
  at ~60% of the visible grid, deferred with `requestAnimationFrame` so the 8-card mount doesn't
  land mid-fling, and the next batch's images are prefetched (`Image.prefetch`, `expo-image`). The
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
  before minification, add a keep rule to the generated `android/app/proguard-rules.pro` (re-applied
  after `expo prebuild --clean` by editing it again, or via a keep-rule snippet in the RN template).
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
  `scripts/restore-keystore.sh` + `scripts/configure-release-signing.sh` before
  `./gradlew assembleRelease`). For a manual build, run those two scripts (see RELEASE.md).
- **"Store file not found"** → `keystore/keystore.properties` (`STORE_FILE`) points to a missing
  file. Confirm the keystore exists and the path is correct (relative to project root). In CI,
  ensure `KEYSTORE_BASE64` secret is set.
- **SigningConfig release missing after `expo prebuild --clean`** → `prebuild` regenerates `android/`
  and drops manual `build.gradle` edits — run `scripts/configure-release-signing.sh` again (see RELEASE.md).
- **CI build fails on `restore-keystore.sh`** → the `KEYSTORE_BASE64`/`KEYSTORE_PASS`/`KEY_ALIAS`/
  `ALIAS_PASS` secrets are missing or wrong; verify with `gh secret list`.
