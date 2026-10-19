# Faazio Mobile (bare React Native SuperApp)

## Run on your phone (JS / Metro only)

Native Android builds are **CI-only** on this machine (local Gradle is OOM-killed). Build/download a
debug APK once, then use Metro for JS changes:

```bash
cd client/mobile
npm install
gh workflow run android-debug.yml
gh run watch
gh run download <run-id> -n faazio-debug-apk
adb install -r app-debug.apk
adb reverse tcp:8081 tcp:8081
npm run start
```

- `npm run start` runs Metro; the installed debug APK loads the bundle over `adb reverse`.
- JS-only changes hot-reload. Native/dependency changes need a new CI APK.
- Release builds: `gh workflow run "Release APK"` (see `docs/RUNBOOKS/RELEASE.md`).
- Configuration (`GATEWAY_URL`, `USE_GATEWAY`, `STRICT`, `DEV_USER`, `CERT_PINS`) is generated into
  `src/lib/config.ts` by `scripts/configure.js`; copy `.env.example` → `.env.local`.
- iOS requires macOS + Xcode: `cd ios && pod install`, then open `Faazio.xcworkspace`.
