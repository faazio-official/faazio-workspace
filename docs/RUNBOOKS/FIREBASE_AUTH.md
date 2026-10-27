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
| iOS | Customer SuperApp | `com.faazio.customer` | `ios/Faazio.xcodeproj` (`PRODUCT_BUNDLE_IDENTIFIER`) |
| iOS | Delivery Partner | `com.faazio.deliverypartner` | `ios/Faazio.xcodeproj` (`Delivery-*` configurations) |
| Firebase project | both | `project-65696e12-8def-460e-b29` | public client config + `FIREBASE_PROJECT_ID` |

Each native app must be registered against its own ID. One typo makes
`signInWithPhoneNumber` fail with an opaque invalid-credential error.

## 2. What is committed (public client config — not secrets)

| File | Purpose |
|---|---|
| `client/mobile/android/app/google-services.json` | Customer Android Firebase app registration + public API key |
| `client/mobile/ios/Faazio/GoogleService-Info.plist` | Customer iOS Firebase app registration (Xcode `Copy Bundle Resources`) |
| `client/mobile/android/app/src/delivery/google-services.json` | Delivery Android app config — **CI-only**, from `GOOGLE_SERVICES_DELIVERY_JSON` (gitignored) |
| `client/mobile/ios/Faazio/GoogleService-Info-Delivery.plist` | Delivery iOS app config — **supplied by ops/CI**, not committed |
| `client/mobile/android/build.gradle` | `com.google.gms:google-services:4.5.0` classpath |
| `client/mobile/android/app/build.gradle` | applies `com.google.gms.google-services` |
| `client/mobile/ios/Faazio/Info.plist` | `UIBackgroundModes → remote-notification` |

The customer files are public by design (the API key is restricted per platform in Google Cloud)
and committed so CI can build without extra secrets. The delivery files contain the partner app's
registration and are injected from CI secrets. No service-account key is used by the mobile app.

## 3. Flow

```
LoginScreen phone entry
  └─ firebaseAuth.sendOtp(digits) → signInWithPhoneNumber(getAuth(), "+91…")
       ├─ Android: Play Integrity / reCAPTCHA → SMS (or auto-retrieval)
       └─ iOS: APNs silent push, else reCAPTCHA → SMS
  └─ user enters 6 digits → firebaseAuth.verifyOtp()
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

The **seller partner app** does not use Firebase Auth (the portal owns its session). It only needs
the native Firebase app for FCM: register `com.faazio.seller`, store its `google-services.json` as
the `GOOGLE_SERVICES_SELLER_JSON` CI secret (iOS: `GoogleService-Info-Seller.plist`), and grant the
notification permission. The FCM token is injected into the portal WebView, which registers it via
`POST /api/gateway/notifications/register`.

The **customer app** uses the same Firebase project for FCM. `services/customerPush.ts` requests
permission after sign-in and registers the token via `POST /notifications/register`; `logout.ts`
calls `DELETE /notifications/register` best-effort. Push delivery requires the gateway's
`PUSH_WEBHOOK_URL` outbox worker (empty = worker disabled, in-app `GET /notifications` still works).
APNs requires the Part 6 `.p8` key + Xcode Push Notifications capability; Android 13+ requires the
runtime notification permission.

## 4. Console setup (already done, except Part 6)

- [x] Firebase project created; Google Analytics disabled.
- [x] Android app registered with `com.faazio.customer` + debug SHA-1/SHA-256.
- [x] iOS app registered with `com.faazio.customer`.
- [ ] Delivery Android app registered with `com.faazio.deliverypartner` (config -> `GOOGLE_SERVICES_DELIVERY_JSON`).
- [ ] Delivery iOS app registered with `com.faazio.deliverypartner` (config -> `GoogleService-Info-Delivery.plist`).
- [x] Authentication → Sign-in method → **Phone** enabled.
- [x] SMS region policy allow-list includes **+91 (India)**.
- [x] Test numbers added (use them for Metro + CI); real SMS for device tests.
- [x] API keys restricted to the Android/iOS apps + Identity Toolkit API.
- [ ] **Part 6 — anti-abuse (blocked): Firebase project is not linked to Google Cloud.**
  - [ ] Enable **Play Integrity API** in the linked GCP project.
  - [ ] App Check → Android app → Play Integrity → **Enforce** (after testing).
  - [ ] Upload the APNs **.p8 auth key** (Key ID + Team ID) for iOS.
  - [ ] Add the **release keystore** SHA-1/SHA-256 in Firebase Project Settings → Your apps.
  - [ ] Xcode: Push Notifications capability + Background Modes → Remote notifications.

Until Part 6 is done, SMS auto-retrieval and silent iOS verification may not work. OTP still works
via manual code entry/reCAPTCHA.

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
| Token works but user rows are missing | `checkout.users` upsert needs Postgres; check `/health` → `db:true`. |
