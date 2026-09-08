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

## 🔧 Gradle / native build failures

- **`compileDebugKotlin FAILED` — `Unresolved reference 'ReactNativeHostWrapper'`**
  → the generated `android/` project is **stale** vs the installed Expo SDK. Regenerate:
  ```bash
  cd client/mobile
  npx expo prebuild --clean
  ```
  > This wipes the gitignored `android/` folder and rewrites it for the current SDK. The
  > release-signing config in `android/app/build.gradle` is manual — re-apply it after
  > prebuild if you regenerated (it references `keystore/keystore.properties`).
- **NDK / CMake issues** → the project needs a recent NDK (Expo SDK 57 pins NDK 27.1).
  Install via Android Studio SDK Manager; confirm `ANDROID_HOME` points at the SDK.
- **Out of memory** → bump Gradle heap in `android/gradle.properties`
  (`org.gradle.jvmargs=-Xmx4096m …` already set).

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

## 🔧 Release signing

- **"Store file not found"** → `keystore/keystore.properties` (`STORE_FILE`) points to a
  missing file. Confirm the keystore exists and the path is correct (relative to project root).
- **SigningConfig release missing** → the `release` config only appears when
  `keystore.properties` exists (see `android/app/build.gradle`).
