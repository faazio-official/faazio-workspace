# Apple App Store Release Manual

This document provides step-by-step instructions to compile, bundle, sign, and upload your **Faazio** iOS application to the Apple App Store Connect portal using **Expo Application Services (EAS)**.

---

## 📋 Prerequisites
1. **Apple Developer Account:** Requires enrollment in the Apple Developer Program ($99/year).
2. **Apple Workstation (Optional but recommended):** Required for local debugging or Xcode management. Not strictly required for EAS Cloud Builds.
3. **EAS CLI Installed:** Execute `npm install -g eas-cli` on your workstation.

---

## 🛠️ Step 1: Configure iOS Settings in `app.json`

Verify that the iOS metadata and strict privacy descriptions are configured inside the `app.json` root.

```json
"ios": {
  "supportsTablet": true,
  "bundleIdentifier": "com.faazio.customer",
  "infoPlist": {
    "NSCameraUsageDescription": "This app requires camera access to upload medical prescriptions and scan product bar codes.",
    "NSPhotoLibraryUsageDescription": "This app requires photo library access to upload medical prescriptions and custom profile photos."
  }
}
```
> **CRITICAL:** Apple strictly rejects applications that do not supply clean, context-specific descriptions in `infoPlist` for camera or photo permissions. Ensure these explanations are written clearly.

---

## 🔑 Step 2: Configure Apple Provisioning Credentials

Apple requires dual-layer security for code-signing:
1. **Distribution Certificate:** Verifies your identity as an Apple Developer.
2. **Provisioning Profile:** Maps your Bundle Identifier to devices authorized for deployment.

### Automated Credential Provisioning (EAS Credentials)
When you run EAS Build, Expo will automatically establish the proper link to your Apple Developer account and create these resources dynamically.
1. Initiate the cloud credentials helper:
   ```bash
   eas credentials
   ```
2. Choose **iOS** -> **production** configuration.
3. Authenticate with your Apple ID and Developer Team ID.
4. EAS will automatically generate your App ID, Distribution Certificate, and App Store Provisioning Profile.

---

## 📦 Step 3: Run the Production iOS Build

To trigger a production iOS App Store Package (`.ipa`) build on Expo cloud servers, execute:

```bash
eas build --platform ios --profile production
```

This commands executes the following:
1. Standardizes TypeScript code compilation.
2. Spins up a secure, remote macOS container equipped with Xcode.
3. Automatically fetches Apple signing credentials from the secure EAS store.
4. Builds the native CocoaPods workspace and compiles the code to an optimized `.ipa` bundle.
5. Emits a downloadable download link and posts it on your Expo Dashboard.

---

## 📤 Step 4: Submitting to App Store Connect

### Method A: Automated Cloud Submission (Recommended)
You can submit directly to TestFlight and App Store Connect by running:
```bash
eas submit --platform ios
```
*EAS will request your App Store Connect App-Specific Password (generated in appleid.apple.com) and proceed to upload the signed `.ipa` natively.*

### Method B: Manual Transporter Upload
If you have a local macOS computer:
1. Install **Transporter** from the Mac App Store.
2. Open Transporter and log in with your Apple ID.
3. Drag and drop the downloaded `.ipa` bundle.
4. Click **Deliver** to upload the package.

---

## 🚀 Step 5: TestFlight and Store Front Review

1. **TestFlight Distribution:**
   - Log into [App Store Connect](https://appstoreconnect.apple.com/).
   - Select your App -> **TestFlight**.
   - Select the newly processed build, add a group of **Internal Testers** or **External Testers**, and immediately distribute the build for real-world testing.

2. **App Store Connect Metadata Compilation:**
   - Compile store descriptions, keywords, support URLs, and marketing content.
   - Attach high-resolution iPad and iPhone screenshots (required for App Store review).
   - Answer the **App Privacy** questionnaire (specifically state what user data is transferred).

3. **Submit for Review:**
   - Select **App Store** -> **Add Build**.
   - Attach your approved TestFlight build.
   - Click **Submit for Review**. Apple's review process generally takes 24 to 48 hours.

---

## 💡 App Store Guidelines & Apple Policy Warnings
- **Guideline 5.1.1 (Privacy - Data Collection):** Since this app handles pharmaceutical transactions and payments, you **must** supply a valid, publicly hosted **Privacy Policy URL**.
- **In-App Purchases (Guideline 3.1.1):** Dinner bookings and physical goods/pharmaceuticals fall under **Physical Goods & Services**. Therefore, you **DO NOT** use Apple In-App Purchases; standard credit card gateways (like Stripe or Adyen) are authorized.
- **Guideline 2.1 (App Completeness):** Apple strictly rejects applications that show incomplete views, dummy placeholders, or broken navigation paths. Populate your screens fully before submitting for production review.

---

## See also

- Root release guide (local Gradle + store checklist): `docs/RUNBOOKS/RELEASE.md`.
- iOS permission strings live in `app.json` → `ios.infoPlist` (not this EAS example).
