# Firebase Phone OTP (mobile auth)

> **Status:** mobile + gateway are wired to **Firebase Phone Auth**. The anti-abuse setup
> (**Part 6: Play Integrity / APNs**) is **NOT completed** — the Firebase project is not linked
> to Google Cloud yet, so it must be finished later. Until then Android may show reCAPTCHA on
> devices without Play Services, and iOS always falls back to the reCAPTCHA web flow.

## 1. Identifiers (must match exactly)

| Platform | Product | Identifier | Source |
|---|---|---|---|
| Android | Customer SuperApp | `com.faazio.customer` | `client/mobile/android/app/build.gradle` (`applicationId`) |
| Android | Delivery Partner | `com.faazio.deliverypartner` | `client/mobile/android/app/build.gradle` (`delivery` flavor) |
| Android | Seller Partner | `com.faazio.sellerpartner` | `client/mobile/android/app/build.gradle` (`seller` flavor) |
| iOS | Customer SuperApp | `com.faazio.customer` | `ios/Faazio.xcodeproj` (`PRODUCT_BUNDLE_IDENTIFIER`) |
| iOS | Delivery Partner | `com.faazio.deliverypartner` | `ios/Faazio.xcodeproj` (`Delivery-*` configurations) |
| iOS | Seller Partner | `com.faazio.sellerpartner` | `ios/Faazio.xcodeproj` (`Seller-*` configurations) |
| Firebase project | all apps | `project-65696e12-8def-460e-b29` | public client config + `FIREBASE_PROJECT_ID` |

Each native app must be registered against its own ID. One typo makes
`signInWithPhoneNumber` fail with an opaque invalid-credential error.

## 2. What is committed (public client config — not secrets)

| File | Purpose |
|---|---|
| `client/mobile/android/app/google-services.json` | Customer Android Firebase app registration + public API key |
| `client/mobile/ios/Faazio/GoogleService-Info.plist` | Customer iOS Firebase app registration (Xcode `Copy Bundle Resources`) |
| `client/mobile/android/app/src/delivery/google-services.json` | Delivery Android app config — **committed** (public client config); CI overwrites it from `GOOGLE_SERVICES_DELIVERY_JSON` |
| `client/mobile/ios/Faazio/GoogleService-Info-Delivery.plist` | Delivery iOS app config — **supplied by ops/CI**, not committed |
| `client/mobile/android/app/src/seller/google-services.json` | Seller Android app config — **committed** (public client config); CI overwrites it from `GOOGLE_SERVICES_SELLER_JSON` |
| `client/mobile/ios/Faazio/GoogleService-Info-Seller.plist` | Seller iOS app config — **supplied by ops/CI**, not committed |
| `client/mobile/android/build.gradle` | `com.google.gms:google-services:4.5.0` classpath |
| `client/mobile/android/app/build.gradle` | applies `com.google.gms.google-services` |
| `client/mobile/ios/Faazio/Info.plist` (customer) / `Info-Delivery.plist` / `Info-Seller.plist` | Per-variant `UIBackgroundModes → remote-notification`; delivery also declares `location` |

The Firebase files are public by design (the API key is restricted per platform in Google Cloud) and
committed so CI can build without extra secrets — the customer, delivery and seller Android
`google-services.json` files are all committed. The iOS partner plists are injected by CI. CI also
overwrites the committed partner Android JSONs from the delivery/seller secrets so a rotated config
never needs a git change. No service-account key is used by the mobile app.

## 3. Flow

```
LoginScreen / delivery PhoneEntry
  └─ SMS User Consent armed BEFORE the SMS is requested
       └─ firebaseAuth.sendOtp(digits) → signInWithPhoneNumber(getAuth(), "+91…")
            ├─ Android: Play Integrity / reCAPTCHA → SMS (or native auto-retrieval)
            └─ iOS: APNs silent push, else reCAPTCHA → SMS
  └─ Android SMS User Consent (src/lib/smsUserConsent.ts + SmsUserConsentModule.kt)
       └─ Play Services consent sheet → 6-digit code → fills the OTP UI + auto-submits
  └─ native auto-retrieval (when supported) → onAuthStateChanged → session, no typing
  └─ user enters 6 digits (or the code is autofilled) → firebaseAuth.verifyOtp()
       └─ ConfirmationResult.confirm(code) → Firebase user + ID token (RS256 JWT)
            └─ authStore.login() stores {token, user} in the Keychain
                 └─ GatewayClient sends `Authorization: Bearer <ID token>`
                      └─ gateway FirebaseVerifier checks signature/iss/aud/exp/sub
                           └─ checkout.ProvisionUserID links auth_uid → checkout.users
```

`sendOtp`/`verifyOtp` sign in the **primary** Firebase app so `refreshIdToken()` can rotate the
session. Seller onboarding uses `sendSellerOtp`/`verifySellerOtp`, a disposable secondary app, because
that OTP is only a signature and must not replace the shopper session. `refreshIdToken()` forces
`getIdToken(true)`; `GatewayClient.recoverSession` uses it once on a 401. Nothing logs the token,
phone number or OTP code.

Android arms **SMS User Consent before** `sendOtp`: the API only observes messages received after
`startSmsUserConsent()`, so `LoginScreen`, delivery `PhoneEntryScreen`, and the `DeleteAccountScreen`
re-auth start a dynamically registered `SMS_RETRIEVED` receiver first (guarded by
`com.google.android.gms.auth.api.phone.permission.SEND`, **no `RECEIVE_SMS`/`READ_SMS` permission**)
and re-arm before every resend. When the user approves the system sheet, the native module extracts
the code (a 6-digit run next to "code"/"OTP"/"PIN", else the first standalone 6-digit run) and emits
it to `useSmsUserConsent`, which fills the OTP input and auto-submits. This is independent of Play
Integrity and works on any device with Google Play Services; otherwise it errors and manual entry is
unchanged. Native Firebase auto-retrieval, when it happens, is surfaced via `onAuthStateChanged`
(the installed v27 modular API has no `onVerificationCompleted` callback); `LoginScreen` and
delivery `OtpVerifyScreen` consume that session and skip code entry. iOS needs no native path —
`textContentType="oneTimeCode"` drives QuickType. The module requires a native rebuild
(`gh workflow run android-debug.yml -f app=customer`); no SMS body, sender, phone number or code is
logged.

**Account deletion deletes the Firebase identity client-side:** `DeleteAccountScreen` runs a fresh
phone-OTP re-auth (`sendReauthOtp`/`verifyReauthOtp`), then `deleteAccountEverywhere()` calls the
gateway `DELETE /users/me`, then native `user.delete()` (`authStore.deleteFirebaseIdentity` →
`services/firebaseAuth.deleteFirebaseUser`) removes the phone account at Firebase. The re-auth is
both a security gate and Firebase's recent-login requirement for `user.delete()`. **The gateway uses
no Admin SDK** — it only nulls `checkout.users.auth_uid` on deletion, so a fresh `DELETE /users/me`
is what unlinks the identity server-side; the client delete is the cleanup of the Firebase account
itself.

The **seller partner app** does not use Firebase Auth (the portal owns its session). It only needs
the native Firebase app for FCM: register `com.faazio.sellerpartner`, store its `google-services.json` as
the `GOOGLE_SERVICES_SELLER_JSON` CI secret (iOS: `GoogleService-Info-Seller.plist`), and grant the
notification permission. The FCM token is injected into the portal WebView, which registers it via
`POST /api/gateway/notifications/register`.

The **customer app** uses the same Firebase project for FCM. `services/customerPush.ts` requests
permission after sign-in and registers the token via `POST /notifications/register`; `logout.ts`
calls `DELETE /notifications/register` best-effort. Push delivery comes from the **gateway's embedded
FCM HTTP v1 sender** when `FCM_PROJECT_ID` + `FCM_SERVICE_ACCOUNT_JSON` are set (see below); without
them the worker is disabled and the in-app `GET /notifications`
still works. The iOS client side is now in place — the shared entitlements carry
`aps-environment` (`production` for the `*Release` configs, `development` for `*Debug`) and every
variant declares `UIBackgroundModes → remote-notification` — so APNs delivery only needs the Part 6
`.p8` key uploaded to Firebase plus the delivery/seller iOS apps registered. Android 13+ requires the
runtime notification permission.

### Server-side FCM push credentials (Android)

- The Android client config (`google-services.json`) is **public** and already committed. Sending is
  a separate, **secret** server-side credential: Firebase Console → Project Settings → Service
  Accounts → **Generate new private key** (JSON). Active sender account:
  `firebase-adminsdk-fbsvc@project-65696e12-8def-460e-b29.iam.gserviceaccount.com` (project
  `project-65696e12-8def-460e-b29`, project number `29787592730`, GCP folder `info-faazio-org`).
- Set these on the gateway (never commit the JSON):
  - `FCM_PROJECT_ID` — public; `project-65696e12-8def-460e-b29` (already declared in `render.yaml`).
  - `FCM_SERVICE_ACCOUNT_JSON` — the **entire** downloaded JSON file contents. For shell sourcing
    (`set -a; . ./.env`) write it as one double-quoted line with inner quotes escaped. Treat it as a
    secret: Render dashboard env var only (`sync: false` in `render.yaml`); locally it lives in the
    gitignored `server/gateway/.env`.
- On startup the gateway builds an `FCMSender` when both are set (log
  `notifications: using FCM HTTP v1 sender (project=…)`) and calls
  `https://fcm.googleapis.com/v1/projects/{project}/messages:send` directly — **no relay server is
  needed**. Android push works immediately; iOS still requires the APNs
  `.p8` key + Push Notifications capability (Part 6) and is unaffected by this.
- `go test ./internal/notifications/ -run TestNewFCMSenderLiveCredentials -v` (from a terminal with
  `server/gateway/.env` sourced) confirms a key parses before a deploy; it skips when the env vars
  are unset.

## 4. Console setup (already done, except Part 6)

- [x] Firebase project created; Google Analytics disabled.
- [x] Android app registered with `com.faazio.customer`.
- [ ] **Signing fingerprints are not fully registered — phone OTP fails on debug APKs.**

  > Digests are not repeated here. The single source of truth for every app's release and debug
  > SHA-1/SHA-256, and what is registered where, is
  > `docs/RUNBOOKS/SIGNING_FINGERPRINTS.md` §5 — **gitignored**, so it exists only on a local
  > machine that has it, never in a fresh clone.

  Summary as of 2026-11-02: no debug SHA-1 is registered on **any** of the three
  Firebase apps, and `com.faazio.customer` carries a **stale release SHA-1**. Firebase validates
  the signing cert's SHA-1 during the app-identifier check, so **phone OTP fails on every debug
  APK with a real number** while Firebase *test* numbers still work — they skip the
  app-verification round trip. The customer release SHA-1 mismatch additionally breaks phone OTP
  for a production build.

  **Fix:** add the fingerprints listed in `SIGNING_FINGERPRINTS.md` §5 (local copy) to each Android app in
  Firebase Console → Project Settings → Your apps → *Add fingerprint*, and remove the stale
  customer SHA-1. No rebuild is needed — fingerprints are read server-side per request.

  **Symptom chain in logcat** (this is what to grep for):
  ```
  E FirebaseAuth: [SmsRetrieverHelper] SMS verification code request failed:
                  unknown status code: 18002 Invalid PlayIntegrity token; app not Recognized by Play Store.
  E FirebaseAuth: [GetAuthDomainTask] Error getting project config. Failed with INVALID_CERT_HASH 400
  E zzh: Failed to get reCAPTCHA token with error [There was an error while trying to get your
         package certificate hash.] - calling backend without app verification
  E FirebaseAuth: [SmsRetrieverHelper] SMS verification code request failed: unknown status code: 17093
  W ReactNativeJS: '[phone-auth] sendOtp failed:', 'auth/missing-client-identifier'
  ```
- [x] iOS app registered with `com.faazio.customer`.
- [x] Delivery Android app registered with `com.faazio.deliverypartner` (config -> `GOOGLE_SERVICES_DELIVERY_JSON`).
- [ ] Delivery iOS app registered with `com.faazio.deliverypartner` (config -> `GoogleService-Info-Delivery.plist`).
- [x] Seller Android app registered with `com.faazio.sellerpartner` (config -> `GOOGLE_SERVICES_SELLER_JSON`).
- [ ] Seller iOS app registered with `com.faazio.sellerpartner` (config -> `GoogleService-Info-Seller.plist`).
- [x] Authentication → Sign-in method → **Phone** enabled.
- [x] SMS region policy allow-list includes **+91 (India)**.
- [x] Test numbers added (use them for Metro + CI); real SMS for device tests.
- [x] API keys restricted to the Android/iOS apps + Identity Toolkit API.
- [x] Server FCM service-account key generated (`firebase-adminsdk-fbsvc@project-65696e12-8def-460e-b29`).
- [ ] **Part 6 — anti-abuse (blocked): Firebase project is not linked to Google Cloud.**
  - [ ] Enable **Play Integrity API** in the linked GCP project.
  - [ ] App Check → Android app → Play Integrity → **Enforce** (after testing).
  - [ ] Upload the APNs **.p8 auth key** (Key ID + Team ID) for iOS.
  - [ ] Add each app's **release** and its own **debug** SHA-1/SHA-256 in Firebase Project
    Settings → Your apps. Digests and current gaps: `SIGNING_FINGERPRINTS.md` §5 (local copy).
  - [x] Push Notifications capability + Background Modes → Remote notifications — committed in the
    repo (`ios/Faazio/Faazio.entitlements` = `aps-environment production` for `*Release`,
    `ios/Faazio/Faazio-Debug.entitlements` = `development` for `*Debug`; `remote-notification` in all
    three variant plists). Only the `.p8` upload above remains.

Until Part 6 is done, native SMS auto-retrieval and silent iOS verification may not work. Android
SMS User Consent still autofills (it is independent of Play Integrity), and manual code
entry/reCAPTCHA remains the fallback everywhere.

## 5. Server configuration

| Env | Value | Notes |
|---|---|---|
| `FIREBASE_PROJECT_ID` | `project-65696e12-8def-460e-b29` | Enables Firebase ID-token verification; set in `render.yaml` and local `server/gateway/.env` |
| `AUTH_DISABLED` | `false` | Production must verify tokens |
| `SUPABASE_JWT_SECRET` | (optional) | Legacy HS256 fallback for the partner portal only |

**Before deploying the Firebase verifier**, apply `server/supabase/migrations/0031_firebase_auth_uid.sql`
in the Supabase SQL editor (it widens `checkout.users.auth_uid` from `UUID` to `TEXT`, since Firebase
UIDs are not UUIDs). Without it the first authenticated call fails with an invalid-uuid error.

The gateway uses **no** Firebase Admin SDK: `internal/platform/auth.FirebaseVerifier` fetches
Google's x509 keys (`securetoken@system.gserviceaccount.com`), caches them by `Cache-Control`, and
verifies RS256 locally. The legacy Supabase HS256 verifier is only tried after Firebase fails and a
secret is configured.

## 6. Verify

```bash
# gateway unit tests (signature, iss/aud/exp/sub, middleware)
cd server/gateway && go test ./internal/platform/auth/...

# mobile types + module boundaries
cd client/mobile && npm run ts:check && npm run check:boundaries
```

Device smoke test (CI debug APK):

1. Add a Firebase test number in the console (e.g. `+91 90000 00001`, code `123456`).
2. Enter the number in `LoginScreen`; the code screen must open.
3. Enter the test code; `LoginScreen` → `LanguageSelection` and the Keychain session exists.
4. Confirm an auth-gated write works (cart/favourite/rating) against Render.

## 7. Common failures

| Symptom | Cause / fix |
|---|---|
| `auth/invalid-app-credential` | App signature/SHA not registered, or package/bundle ID mismatch. Add debug + release SHA-1/SHA-256. |
| Send always fails on iOS | Part 6 APNs not configured; reCAPTCHA fallback should still open. Add the `.p8` key. |
| `401` from the gateway after login | `FIREBASE_PROJECT_ID` mismatch with the token `aud`/`iss`, or the gateway still runs `AUTH_DISABLED=false` with no Firebase verifier. Check Render env. |
| SMS never arrives | Region policy excludes +91, the number is not a test number, or the free quota is exhausted (Blaze billing required past the quota). |
| No SMS-autofill consent sheet | Google Play Services is missing/outdated, the APK predates the native module, or the retriever was armed **after** the SMS was sent. Type the code manually; rebuild via `gh workflow run android-debug.yml -f app=customer`. |
| Consent approved but the code is not filled | The message must contain a 6-digit run and be surfaced by Play Services. Type the code manually; no `RECEIVE_SMS` permission is involved. |
| Auto-verification never skips the OTP screen | Firebase templates usually cannot use hash-based auto-retrieval; SMS User Consent is the normal fast path. Manual entry remains available. |
| OTP screen shows an error right after a resend | An older `confirm()` resolved against a newer send; pending requests are request-scoped now, so retry once and report if it recurs. |
| Token works but user rows are missing | `checkout.users` upsert needs Postgres; check `/health` → `db:true`. |
