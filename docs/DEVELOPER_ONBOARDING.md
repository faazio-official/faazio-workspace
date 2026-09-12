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

```bash
adb devices                 # confirm a device shows up (e.g. RZ8NA1WCLWL device)
npm run android             # expo run:android → builds + installs + launches
```

- First build compiles native code (Gradle) and can take several minutes.
- If Metro is already running on port 8081, `expo run:android` reuses it.
- Full-screen, non-scrollable layout per AGENTS.md rule 8.

### Speed tip: build for one ABI during local dev

Dev builds compile native code (reanimated/worklets C++) for **all 4 ABIs** by default. To build
only for the device/emulator's ABI (~75% less native work) on a fast, focused dev loop:

```bash
npx expo run:android -- --active-arch-only
# or explicitly:
cd android && ./gradlew installDebug -PreactNativeArchitectures=arm64-v8a
```

> This is a **dev-only** optimization. Release CI builds use `arm64-v8a,armeabi-v7a` (see
> `docs/RUNBOOKS/RELEASE.md`). Don't ship a single-ABI release for GitHub distribution unless
> arm64-only is intentional.

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
