# Faazio Mobile (bare React Native SuperApp)

## Run on your phone (JS / Metro only)

Native Android builds are **CI-only** on this machine (local Gradle is OOM-killed). Build/download a
debug APK once, then use Metro for JS changes:

```bash
cd client/mobile
npm install
gh workflow run android-debug.yml -f app=customer   # or -f app=delivery
gh run watch
gh run download <run-id> -n faazio-customer-debug-apk
adb install -r app-customer-debug.apk
adb reverse tcp:8081 tcp:8081
npm run start
```

- `npm run start` runs Metro; the installed debug APK loads the bundle over `adb reverse`.
- JS-only changes hot-reload. Native/dependency changes need a new CI APK.
- Three products share this shell: `customer` (SuperApp, `index.js`), `delivery` (standalone
  Delivery Partner, `index.delivery.js`, `com.faazio.deliverypartner`) and `seller` (Seller Partner,
  `index.seller.js`, `com.faazio.sellerpartner`). Partner builds need `APP_VARIANT=delivery` /
  `APP_VARIANT=seller` + the partner Firebase config; see `docs/RUNBOOKS/RELEASE.md`.
- Release builds: `gh workflow run "Release APK"` (see `docs/RUNBOOKS/RELEASE.md`).
- Configuration is generated into `src/lib/config.ts` by `scripts/configure.js`. Each Android app
  has its own complete env file (`.env.android.customer` / `.env.android.delivery` /
  `.env.android.seller`, selected by `APP_VARIANT`); iOS uses one `.env.ios`. All are standalone
  (shared values duplicated); a gitignored `.env.local` overrides. `CONFIGURE_PLATFORM=android|ios`
  selects the platform (`npm run configure:android:<app>` / `configure:ios`).
- iOS requires macOS + Xcode for a manual build (`cd ios && pod install`, open `Faazio.xcworkspace`).
  Releases build, sign and upload to TestFlight in CI: `gh workflow run ios-release.yml`.
