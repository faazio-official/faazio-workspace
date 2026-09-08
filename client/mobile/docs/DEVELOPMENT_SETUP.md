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
npm install        # postinstall runs patch-package — must succeed
adb devices        # confirm a device
npm run android    # expo run:android → build + install + launch
```

## Verify every change

```bash
npm run ts:check          # typecheck
npm run check:boundaries  # dependency-cruiser
```

## Key scripts (`client/mobile/package.json`)

- `npm run start` — Metro dev server
- `npm run android` / `npm run ios` — build + run on platform
- `npm run web` — Expo web (`--port 3000`)
- `npm run ts:check` — TypeScript typecheck
- `npm run check:boundaries` — dependency-cruiser import rules

## See also

- **Root onboarding (canonical):** `docs/DEVELOPER_ONBOARDING.md`
- Troubleshooting: `docs/RUNBOOKS/TROUBLESHOOTING.md`
