# Local Development Setup Guide

Follow this guide to configure your workstation and boot the **SuperApp** project in a local development environment.

---

## 💻 Prerequisites

Ensure you have the following installed on your machine:
1. **Node.js:** v18.x or v20.x (LTS recommended)
2. **Package Manager:** `npm` (bundled with Node) or `yarn`
3. **Git:** For version control
4. **TypeScript:** Managed via project dependencies

---

## 🚀 Getting Started

### 1. Clone & Install Dependencies
Navigate into the React Native app subdirectory and trigger package installation:

```bash
cd react-native-app
npm install
```

### 2. Configure Local Testing Clients (Expo Go)
For ultra-fast compilation and immediate feedback on physical mobile hardware without configuring Xcode or Android Studio:
1. Download **Expo Go** from the iOS App Store or Google Play Store onto your physical device.
2. Ensure your computer and your phone are connected to the same Wi-Fi network.

### 3. Spin Up the Development Server
Execute the launch script to start the Metro bundler:

```bash
npm run start
```

This will spin up the Metro compiler and display a QR code in your terminal.
- **Android / iOS (Expo Go):** Open your phone's camera (iOS) or the Expo Go App (Android) and scan the terminal's QR code. The app will compile and load instantly.
- **Press `a`:** Boots the app on a connected Android Emulator.
- **Press `i`:** Boots the app on a local iOS Simulator.

---

## 📱 Emulator Setup Instructions

### Android Emulator Setup
1. Download and install [Android Studio](https://developer.android.com/studio).
2. Open Android Studio -> Tools -> **Device Manager**.
3. Create a Virtual Device (Pixel 6/7/8 running Android API level 33+).
4. Start the emulator.
5. In your project terminal, press `a` to install and run the app.

### iOS Simulator Setup (macOS only)
1. Download **Xcode** from the Mac App Store.
2. Open Xcode -> Settings -> **Platforms** -> Download iOS platform simulators.
3. In your project terminal, press `i` to install and boot the app on the simulator.

---

## 🛠️ Key CLI Commands

- **`npm run start`** - Start Metro development server.
- **`npm run android`** - Direct-launch target Android.
- **`npm run ios`** - Direct-launch target iOS.
- **`npm run ts:check`** - Run compiler validation on type files.

---

## 🔒 Configuration & Environments
Before invoking API endpoints:
1. Copy `.env.example` in the server project as a base.
2. Declare local API endpoints in a local `.env` configuration file inside `react-native-app/`.
3. Read environment values using `expo-constants` dynamically:
   ```ts
   import Constants from 'expo-constants';
   const apiURL = Constants.expoConfig?.extra?.apiUrl;
   ```
