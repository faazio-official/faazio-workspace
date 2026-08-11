# Faazio Mobile (React Native / Expo SuperApp)

## Prerequisites

- Phone connected via **USB debugging** (developer mode enabled, `adb devices` shows it as `device`).
- If Expo Go is not installed, `npm run android` installs it automatically.

## Test on device (recommended workflow)

Run these from `client/mobile/`:

```bash
adb devices            # confirm the phone is connected (should show "<id>  device")
npm run android        # starts Metro, installs Expo Go if needed, bundles, and launches the app
```

Notes:

- `npm run android` is `expo start --android`. Expo CLI automatically:
  1. starts Metro on port 8081,
  2. sets up the USB tunnel (`adb reverse tcp:8081 tcp:8081`),
  3. opens the app in Expo Go on the connected phone.
- The process runs in the foreground; keep that terminal open. To stop: `Ctrl+C`.

## Verify the server manually

```bash
curl -s http://localhost:8081/status   # → packager-status:running
adb shell dumpsys activity activities | grep topResumedActivity   # → host.exp.exponent... (app is in foreground)
```

## Useful scripts

| Command | What it does |
| --- | --- |
| `npm run android` | Start Metro + open app on connected Android phone (recommended) |
| `npm run start` | Start Metro (LAN mode, scan QR from Expo Go) |
| `npm run web` | Start Expo web build on port 3000 |
| `npm run ts:check` | Typecheck the whole project (`tsc`) |
| `npm run check:boundaries` | Validate module dependency boundaries |

## Typecheck before finishing

After code changes, always run:

```bash
npm run ts:check
```
