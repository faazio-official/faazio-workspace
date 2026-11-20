# Faazio Mobile — Local Development Setup

> **Stale-content replacement.** The canonical getting-started guide lives at root
> `docs/DEVELOPER_ONBOARDING.md`. This file is a short pointer + corrected summary.

## Prerequisites

- **Node.js** 20+ (LTS) with `npm`
- **JDK** 17+ (21 works)
- **Android SDK** + `platform-tools` (`adb`) with `ANDROID_HOME` set
- **Git**

> iOS requires macOS + Xcode.

## Get started

```bash
cd client/mobile
npm install        # postinstall runs patch-package + configure.js — must succeed
adb devices        # confirm a device
npm run start      # Metro (keep running)
# native builds are CI-only: gh workflow run android-debug.yml, then adb install
```

## Verify every change

```bash
npm run ts:check          # typecheck
npm run check:boundaries  # dependency-cruiser
```

## Key scripts (`client/mobile/package.json`)

- `npm run start` — Metro dev server
- `npm run android` / `npm run ios` — build + run locally (do **not** run Android here: CI-only)
- `npm run configure` — regenerate `src/lib/config.ts` from env
- `BUILD_VARIANT=debug|prod` — build type for `configure` (default `debug`; `prod` is the release
  config). Set by the CI workflows to match the Gradle build type.
- `npm run assembleDebug<Customer|Delivery|Seller>` — dispatch the debug APK CI build
- `npm run assembleProd<Customer|Delivery|Seller>` — dispatch the signed release APK CI build
  (extra flags pass through: `-- --version=1.0.1 --include-aab`)
- `npm run ts:check` — TypeScript typecheck
- `npm run check:boundaries` — dependency-cruiser import rules

Native builds are CI-only (never run Gradle locally). Full dispatch details:
`docs/RUNBOOKS/CI_PIPELINE.md` → "Debug vs prod — one command per app, still CI-only".

## See also

- **Root onboarding (canonical):** `docs/DEVELOPER_ONBOARDING.md`
- Troubleshooting: `docs/RUNBOOKS/TROUBLESHOOTING.md`
