# Faazio Mobile (React Native / Expo SuperApp)

## Run on your phone

Connect your phone via USB debugging (`adb devices` must show it as `device`), then from `client/mobile/` run:

```bash
adb devices
npm run android
```

Notes:

- `npm run android` compiles the native app, installs it on the connected phone, starts Metro, and launches the app.
- Keep the terminal open; press `Ctrl+C` to stop.
