# Google Play Store Release Manual

This document provides step-by-step instructions to compile, bundle, sign, and upload your **SuperApp** Android application to the Google Play Store Console using **Expo Application Services (EAS)**.

---

## 📋 Prerequisites
1. **Google Play Developer Account:** Requires a one-time registration fee ($25).
2. **EAS CLI Installed:** Execute `npm install -g eas-cli` globally on your workstation.
3. **Expo Account:** Register at [expo.dev](https://expo.dev) to manage remote cloud builds.

---

## 🛠️ Step 1: Configure Android Settings in `app.json`

Verify that the Android metadata is fully configured in the `app.json` root.

```json
"android": {
  "package": "com.superapp.customer",
  "versionCode": 1,
  "adaptiveIcon": {
    "foregroundImage": "./assets/adaptive-icon.png",
    "backgroundColor": "#FFFFFF"
  },
  "permissions": [
    "CAMERA",
    "READ_EXTERNAL_STORAGE",
    "WRITE_EXTERNAL_STORAGE"
  ]
}
```
> **CRITICAL:** The package name (`com.superapp.customer`) must be globally unique across all Android apps.

---

## 📦 Step 2: Initialize EAS Project Configs

1. Log into your Expo account:
   ```bash
   eas login
   ```
2. Initialize EAS configuration in your project root:
   ```bash
   eas project:init
   ```
3. Generate the standard `eas.json` configuration file:
   ```bash
   eas build:configure
   ```

Verify your generated `eas.json` looks like this for production releases:

```json
{
  "cli": {
    "version": ">= 9.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

---

## 🔑 Step 3: Generating the Upload Key (Keystore)

Android requires all released packages to be digitally signed with a cryptographic certificate (Keystore). 

- **Option A (Recommended): Let EAS Handle Keystore Generation**
  When you trigger your first production build via EAS, Expo will ask you:
  *`Would you like us to generate an Android Keystore for you?`*
  Type **`Y`** (Yes). EAS will securely generate and store the Keystore inside the cloud dashboard. You can download this credential anytime via the Expo Dev console.

- **Option B (Manual Keystore Generation):**
  If you need to sign locally, run this command in your shell:
  ```bash
  keytool -genkey -v -keystore superapp-release.keystore -alias superapp-alias -keyalg RSA -keysize 2048 -validity 10000
  ```
  *Make sure to back up your Keystore securely. If you lose your signing key, you will never be able to update your app in Google Play!*

---

## 🚀 Step 4: Run the Production Cloud Build

To trigger a production Google Play App Bundle (`.aab`) build, run:

```bash
eas build --platform android --profile production
```

This commands executes the following:
1. Compiles all JavaScript, TypeScript, and assets into a single static bundle.
2. Boots up a secure cloud container on Expo servers.
3. Generates the Native Android source project.
4. Inject credentials/keystores and signs the bundle.
5. Emits a downloadable, optimized `.aab` file.

---

## 📤 Step 5: Submitting to Google Play Store

Once the build finishes successfully:

### Method A: Automated CLI Submission
You can submit directly using EAS Submit CLI:
```bash
eas submit --platform android
```
*Note: For first-time submissions, you must manually upload the initial bundle via the Google Play Console UI to establish the package registry.*

### Method B: Manual Web Console Upload
1. Open the [Google Play Console](https://play.google.com/console/).
2. Create a new app or select your existing project.
3. Go to **Testing** -> **Closed testing** or **Production** -> **Create new release**.
4. Drag and drop the downloaded `.aab` bundle file into the upload area.
5. Supply the required metadata (Store description, Screenshots, App Icons, Privacy Policy URL).
6. Fill in the **Content Rating** and **Data Safety** questionnaires.
7. Click **Save** and **Rollout** to begin Google's app review process!

---

## 💡 Play Store Checklist & Troubleshooting
- **API Target level:** Always ensure your app is built using the latest target SDK (handled automatically by Expo SDK 51).
- **Data Safety:** Inform users in the console questionnaire about the use of Camera permissions (Pharma prescription) and SecureStore tokens.
- **64-bit Compliance:** Android requires compiled bundles to contain native binaries for both 32-bit and 64-bit architectures (EAS cloud compiler processes this natively).
