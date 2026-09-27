# Developer Onboarding

Get the Faazio mobile app building and running on a device, end to end.

## 1. System Requirements

- **Node.js** 20+ (LTS recommended) with `npm`
- **JDK** 17+ (Expo SDK 57 / RN 0.86 builds need a recent JDK; 21 works)
- **Android SDK** + `platform-tools` (`adb`) with `ANDROID_HOME` set
- **Git**

> iOS: only on macOS with Xcode + the iOS simulators. This guide focuses on Android
> (the active target), but the steps mirror for iOS via `npm run ios`.

## 2. Initial Setup

```bash
git clone <repo-url> faazio-workspace
cd faazio-workspace/client/mobile
npm install
```

`npm install` runs `postinstall` → `patch-package`, which **must** succeed (it applies the
`@shopify/react-native-skia` patch). If you change deps, re-run `npm install` so patches re-apply.

## 3. Run on a device / emulator

> **Builds are CI-only on this project.** Do **not** run `npm run android` / `expo run:android` /
> `./gradlew` — the host's `systemd-oomd` SIGKILLs Gradle under memory pressure (see
> `docs/RUNBOOKS/TROUBLESHOOTING.md` → "Gradle / native build failures"). Let GitHub Actions build
> the APK, then install the artifact:

```bash
adb devices                                   # confirm a device shows up
gh workflow run android-debug.yml             # debug APK built on GitHub's runners
gh run watch
gh run download <run-id> -n faazio-debug-apk  # -> app-debug.apk
adb install -r app-debug.apk
adb reverse tcp:8081 tcp:8081                 # then: npx expo start   (Metro, local)
```

- Metro (`npx expo start`) runs **locally** — it is the JS bundler, not Gradle.
- The debug APK connects to Metro over `adb reverse` (no rebuild needed for JS changes).
- Full-screen, non-scrollable layout per AGENTS.md rule 8.

### Speed tip: single-ABI debug builds

The CI debug workflow defaults to `arm64-v8a`; pass `-f archs=arm64-v8a,armeabi-v7a` if you need
more. Release CI builds use `arm64-v8a,armeabi-v7a` (see `docs/RUNBOOKS/RELEASE.md`).

## 4. Verify every change

```bash
npm run ts:check          # TypeScript typecheck
npm run check:boundaries  # dependency-cruiser — enforces cross-module import rules
```

Both must pass before pushing. `check:boundaries` fails on any sub-app importing another
sub-app's internals (only `Home` is allowed to cross sub-apps).

### 4a. Ship a release APK

Release builds run in **GitHub Actions**, not on your machine (see `docs/RUNBOOKS/RELEASE.md`):

```bash
cd client/mobile
gh workflow run release-apk.yml -f version=1.0.2 -f tag=v1.0.2
gh run watch                 # wait; signed APK lands on the GitHub Release
```

## 5. Project orientation

| Resource | What it is |
|---|---|
| `ARCHITECTURE.md` (root) | High-level mobile + future-Chi design |
| `docs/` (root) | This guide + architecture deep-dives + runbooks |
| `data/DATA_CONTROL.md` | Data ownership & `@mock`/`@seed`/`@static` status matrix |
| `PAGE_CATALOG.md` (root) | Every screen/path, with navigation routes |
| `PENDING_WORK.md` (`client/mobile/`) | Deferred / backlog work ledger |

Key paths: `@/` → `client/mobile/src/`, `@data/` → root `data/`.

## 6. Next steps

1. Read [architecture/mobile-app.md](./architecture/mobile-app.md) for module/state/nav layout.
2. Read [architecture/data-layer-sdui.md](./architecture/data-layer-sdui.md) before touching `data/`.
3. Follow [RUNBOOKS/DATA_FIXTURES.md](./RUNBOOKS/DATA_FIXTURES.md) when adding mock data.
4. If a build breaks, see [RUNBOOKS/TROUBLESHOOTING.md](./RUNBOOKS/TROUBLESHOOTING.md).

Welcome aboard! 🚀
