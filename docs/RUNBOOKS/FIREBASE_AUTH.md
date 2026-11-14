# Firebase Phone OTP (mobile auth)

> **Status:** mobile + gateway are wired to **Firebase Phone Auth**. The anti-abuse setup
> (**Part 6: Play Integrity / APNs**) is **NOT completed** — the Firebase project is not linked
> to Google Cloud yet, so it must be finished later. Until then Android may show reCAPTCHA on
> devices without Play Services, and iOS always falls back to the reCAPTCHA web flow.
>
> **iOS simulator note:** the reCAPTCHA sheet is *expected*, not a misconfiguration. Firebase
> documents that the iOS simulator **always** uses the reCAPTCHA flow (it cannot receive the
> silent APNs verification push). On a physical iPhone the browser only appears when the APNs
> `.p8` key / Push Notifications capability is missing. For browser-free simulator testing use a
> console test number with `FIREBASE_APP_VERIFICATION_DISABLED=true` (see §3.1).

## 1. Identifiers (must match exactly)

| Platform | Product | Identifier | Source |
|---|---|---|---|
| Android | Customer SuperApp | `com.faazio.customer` | `client/mobile/android/app/build.gradle` (`applicationId`) |
| Android | Delivery Partner | `com.faazio.deliverypartner` | `client/mobile/android/app/build.gradle` (`delivery` flavor) |
| Android | Seller Partner | `com.faazio.sellerpartner` | `client/mobile/android/app/build.gradle` (`seller` flavor) |
| iOS | Customer SuperApp | `com.faazio.customer` | `ios/Faazio.xcodeproj` (`PRODUCT_BUNDLE_IDENTIFIER`; the only iOS app released to the App Store) |
| Firebase project | all apps | `project-65696e12-8def-460e-b29` | public client config + `FIREBASE_PROJECT_ID` |

Each native app must be registered against its own ID. One typo makes
`signInWithPhoneNumber` fail with an opaque invalid-credential error.

## 2. What is committed (public client config — not secrets)

| File | Purpose |
|---|---|
| `client/mobile/android/app/google-services.json` | Customer Android Firebase app registration + public API key |
| `client/mobile/ios/Faazio/GoogleService-Info.plist` | Customer iOS Firebase app registration (Xcode `Copy Bundle Resources`) |
| `client/mobile/android/app/src/delivery/google-services.json` | Delivery Android app config — **committed** (public client config); CI overwrites it from `GOOGLE_SERVICES_DELIVERY_JSON` |
| `client/mobile/android/app/src/seller/google-services.json` | Seller Android app config — **committed** (public client config); CI overwrites it from `GOOGLE_SERVICES_SELLER_JSON` |
| `client/mobile/android/build.gradle` | `com.google.gms:google-services:4.5.0` classpath |
| `client/mobile/android/app/build.gradle` | applies `com.google.gms.google-services` |
| `client/mobile/ios/Faazio/Info.plist` | `UIBackgroundModes → remote-notification` (customer; the only iOS product) |

The Firebase files are public by design (the API key is restricted per platform in Google Cloud) and
committed so CI can build without extra secrets — the customer, delivery and seller Android
`google-services.json` files are all committed. CI also overwrites the committed partner Android JSONs
from the delivery/seller secrets so a rotated config never needs a git change. No service-account key
is used by the mobile app.

### iOS native init (required)

RNFB 27 does **not** auto-configure the default Firebase app on iOS (Android does it through the
`google-services` Gradle plugin). `ios/Faazio/AppDelegate.swift` must call `FirebaseApp.configure()`
(imported from `FirebaseCore`, an explicit SPM product on the app target) before React Native
starts; it reads the bundled `GoogleService-Info.plist` for the active product configuration.

Without it, `getApps()` is empty, `firebaseAuthConfigured()` is false, and `LoginScreen` silently
takes its `__DEV__` placeholder path: no SMS is sent, any six digits "succeed" with a fake
`placeholder.*` token, the gateway 401s, `recoverSession` finds no native user, `expireSession`
clears the session and the navigator resets to `Login` — an apparent OTP → Login loop. Verify the
fix in the simulator by logging `getApps().length` (must be ≥ 1).

## 3. Flow

```
LoginScreen / delivery PhoneEntry / seller signature
  └─ SMS User Consent armed BEFORE the SMS is requested
       └─ firebaseAuth.sendOtp(digits) / sendSellerOtp(phoneDigits)
            → signInWithPhoneNumber(getAuth(), "+91…") (seller: disposable secondary app)
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
that OTP is only a signature and must not replace the shopper session. The seller signature uses the
same Android SMS User Consent path: consent fills the six digits and auto-submits the seller verify,
then the gateway's `auth.OTPSigned` check binds the shared shopper token's `phone_number` claim to the
application's `contactPhone`. The seller screen also refuses a resend while a verify is in flight (and
vice versa), locks the OTP and contact-phone inputs while `otpBusy`, clears the code on a phone edit,
and returns to "Send OTP" if a resend fails (Firebase has already discarded the previous pending
confirmation, so keeping "Verify" would only fail). The seller scope has no `onAuthStateChanged`
auto-retrieval watcher; consent autofill or manual entry is its fast path.
Phone numbers are normalized to E.164 through `src/lib/phone.ts` (`libphonenumber-js`).
`toE164(digits, country = 'IN')` keeps the historical `+91` default for the existing OTP flows. When
the seller has no auth phone, the contact field pairs `CountryCodePicker` (7 countries: IN, US, CA,
AE, GB, SG, AU) with the input and sends the parsed E.164 (`+CC…`) — it no longer truncates to the
last 10 digits. A leading `+` is always treated as international and is never re-homed into another
country; without one, the digits are parsed against the selected country, then fall back to that
country's calling code. In the normal signed-in path the phone comes from the auth session, the
field is read-only, and the picker is not shown.
After submit, `SellerRegistrationScreen` branches on the status: `PENDING_REVIEW` shows a read-only
under-review card (application id + submitted shops), and `ACTIVE` shows the official-seller card
with the Android seller-app download CTA (iOS shows a Play Store hint). On mount the screen also
calls `GatewayClient.getMySellerApplication` (`GET /sellers/me`, `auth.Require`) so the status
survives an app restart: `404` means no application yet (form), `REJECTED`/`SUSPENDED` show the
form with a notice. The application is linked to the shopper via `sellers.sellers.user_id` (0084).
`POST /sellers/{id}/edit` resubmit is `SELLER`-gated and is not reachable for a still-shopper
applicant, which re-submits through the form.
`refreshIdToken()` forces `getIdToken(true)`;
`GatewayClient.recoverSession` uses it once on a 401. Nothing logs the token, phone number or OTP code.

Android arms **SMS User Consent before** `sendOtp`/`sendSellerOtp`: the API only observes messages
received after `startSmsUserConsent()`, so `LoginScreen`, delivery `PhoneEntryScreen`, the
`DeleteAccountScreen` re-auth, and the `SellerRegistrationScreen` signature start a dynamically
registered `SMS_RETRIEVED` receiver first (guarded by
`com.google.android.gms.auth.api.phone.permission.SEND`, **no `RECEIVE_SMS`/`READ_SMS` permission**)
and re-arm before every resend. When the user approves the system sheet, the native module extracts
the code (a 6-digit run next to "code"/"OTP"/"PIN", else the first standalone 6-digit run) and emits
it to `useSmsUserConsent`, which fills the OTP input and auto-submits (including the seller signature
on the disposable secondary app). This is independent of Play Integrity and works on any device with
Google Play Services; otherwise it errors and manual entry is unchanged. Native Firebase
auto-retrieval, when it happens, is surfaced via `onAuthStateChanged`
(the installed v27 modular API has no `onVerificationCompleted` callback); `LoginScreen`, delivery
`OtpVerifyScreen`, and the `DeleteAccountScreen` re-auth consume that session and skip code entry.
If auto-retrieval races a manual `confirm()`, `firebaseAuth` recovers the already-signed-in user
instead of surfacing a false invalid-code error. `smsUserConsent.ts` buffers a code that arrives
before the OTP screen mounts (delivery `PhoneEntryScreen` arms before navigating) and replays it on
mount. iOS needs no native path — `textContentType="oneTimeCode"` drives QuickType. The module
requires a native rebuild
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
the native Firebase app for FCM on Android: register `com.faazio.sellerpartner`, store its
`google-services.json` as the `GOOGLE_SERVICES_SELLER_JSON` CI secret, and grant the notification
permission. The FCM token is injected into the portal WebView, which registers it via
`POST /api/gateway/notifications/register`. (The seller app has no iOS release, so no iOS plist is
needed.)

The **customer app** uses the same Firebase project for FCM. `services/customerPush.ts` requests
permission after sign-in and registers the token via `POST /notifications/register`; `logout.ts`
calls `DELETE /notifications/register` best-effort. Push delivery comes from the **gateway's embedded
FCM HTTP v1 sender** when `FCM_PROJECT_ID` + `FCM_SERVICE_ACCOUNT_JSON` are set (see below); without
them the worker is disabled and the in-app `GET /notifications`
still works. The iOS client side is now in place — the customer entitlements carry
`aps-environment` (`production` for the `Release` config, `development` for `Debug`) and
`ios/Faazio/Info.plist` declares `UIBackgroundModes → remote-notification` — so APNs delivery only
needs the Part 6 `.p8` key uploaded to Firebase. Android 13+ requires the runtime notification
permission.

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

### 3.1 iOS: why a browser opens, and how to avoid it

Firebase verifies the caller with a **silent APNs push**. When that cannot happen it opens an
in-app `SFSafariViewController` asking for reCAPTCHA. Two triggers:

| Situation | Result |
|---|---|
| iOS **simulator** (any build) | Always reCAPTCHA — the simulator has no APNs token. Expected. |
| Physical iPhone, **Part 6 not done** (no APNs `.p8` uploaded / Push Notifications capability missing) | reCAPTCHA every time. Upload the `.p8` key to Firebase → Project Settings → Cloud Messaging to get silent verification. |
| Physical iPhone, Part 6 done | Silent push; the browser is used only as a rare fallback. |

The app registers for remote notifications at launch
(`ios/Faazio/AppDelegate.swift` → `application.registerForRemoteNotifications()`) so the silent
verification push can be used. FirebaseAuth method-swizzling consumes the reCAPTCHA redirect, but
the callback URL scheme must still be present in the **built** `Info.plist`
(`app-<GOOGLE_APP_ID with : → ->`). `ios/scripts/firebase-url-scheme.sh` (run by the
`Firebase URL scheme` build phase) reads `GOOGLE_APP_ID` from the bundled
`GoogleService-Info.plist` and injects the matching scheme. No manual plist
edit is needed; the customer scheme is also committed in `Info.plist` as a fallback.

**Browser-free simulator development:** do not disable verification for real numbers.

1. Firebase console → Authentication → Sign-in method → Phone → **Phone numbers for testing**, add
   e.g. `+91 90000 00001` with code `123456`.
2. Set `FIREBASE_APP_VERIFICATION_DISABLED=true` in `.env.ios` (or the process env) and restart
   Metro. `scripts/configure.js` only honours it for **non-release** builds, and `sendOtp` sets
   `auth.settings.appVerificationDisabledForTesting = true`.
3. Only the registered test numbers will work while the flag is on; set it back to `false` for
   normal device testing.

## 4. Console setup (already done, except Part 6)

- [x] Firebase project created; Google Analytics disabled.
- [x] Android app registered with `com.faazio.customer`.
- [x] **Signing fingerprints registered (verified 2026-11-06).** Firebase validates the installed
  app's signing cert during the app-identifier check. The **Play-delivered** app is signed by
  Google's **Play App Signing** key, *not* the upload key — that is the cert production phone OTP
  needs.

  > Digests are not repeated here. The single source of truth for every app's Play App Signing,
  > upload, and debug SHA-1/SHA-256, and what is registered where, is
  > `docs/RUNBOOKS/SIGNING_FINGERPRINTS.md` §5 — **gitignored**, so it exists only on a local
  > machine that has it, never in a fresh clone.

  Current state (verified via the Firebase Management API):
  - `com.faazio.customer` — Play App Signing `DE:0E:7A:EF:…` (SHA-256 `7B:3C:7B:F0:…`) ✓ and
    debug `5E:8F:16:06:…` ✓. The upload key was reset on 2026-11-10; its new SHA-1 is pending in Firebase — add it before this sideloaded/CI lane needs phone OTP.
  - `com.faazio.sellerpartner` / `com.faazio.deliverypartner` — release/upload ✓ and debug ✓
    (debug added 2026-11-06). Their Play App Signing certs do not exist yet (no Play listing); add
    them here once each listing exists.

  **Fix for a future mismatch:** add the missing fingerprint in Firebase Console → Project
  Settings → Your apps → *Add fingerprint*. No rebuild is needed — fingerprints are read
  server-side per request.

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
- [x] ~~Delivery iOS app~~ — not required (Android/Play only; no partner iOS release).
- [x] Seller Android app registered with `com.faazio.sellerpartner` (config -> `GOOGLE_SERVICES_SELLER_JSON`).
- [x] ~~Seller iOS app~~ — not required (Android/Play only; no partner iOS release).
- [x] Authentication → Sign-in method → **Phone** enabled.
- [x] SMS region policy allow-list includes **+91 (India)**.
- [x] Test numbers added (use them for Metro + CI); real SMS for device tests.
- [x] API keys restricted to the Android/iOS apps + Identity Toolkit API.
- [x] Server FCM service-account key generated (`firebase-adminsdk-fbsvc@project-65696e12-8def-460e-b29`).
- [ ] **Part 6 — anti-abuse (blocked): Firebase project is not linked to Google Cloud.**
  - [ ] Enable **Play Integrity API** in the linked GCP project.
  - [ ] App Check → Android app → Play Integrity → **Enforce** (after testing).
  - [ ] Upload the APNs **.p8 auth key** (Key ID + Team ID) for iOS.
  - [x] Add each app's **Play App Signing / release** and its own **debug** SHA-1/SHA-256 in
    Firebase Project Settings → Your apps. Customer Play App Signing + debug done; seller/delivery
    release + debug done; seller/delivery Play App Signing certs pending their listings.
    Digests: `SIGNING_FINGERPRINTS.md` §5 (local copy).
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
| App crashes (SIGTRAP, `PhoneAuthProvider.swift` `fatalError`) when sending OTP on iOS | FirebaseAuth `verifyPhoneNumber` fatals when its callback URL scheme (`app-<GOOGLE_APP_ID with : → ->`) is missing from the built `Info.plist`; it trips before any network call. `ios/scripts/firebase-url-scheme.sh` (the `Firebase URL scheme` phase) injects it from the bundled `GoogleService-Info.plist`. If it recurs, the build predates that phase or the bundled Firebase plist has no `GOOGLE_APP_ID`: clean build, confirm the phase ran (look for the `note: added Firebase Auth URL scheme …` log line), and check the active `GoogleService-Info*.plist`. If `CLIENT_ID` exists, its reversed value is the equivalent scheme. With swizzling enabled (default) FirebaseAuth consumes the redirect itself; only forward URLs to `Auth.auth().canHandle(url)` in `AppDelegate.application(_:open:options:)` if swizzling is disabled. |
| `401` from the gateway after login | The gateway builds the Firebase verifier only when `FIREBASE_PROJECT_ID` is non-empty (`config.Config.FirebaseProjectID`); if empty it verifies only portal/legacy HS256 tokens, so every Firebase ID token (RS256) 401s. Check: a valid token whose `iss` = `https://securetoken.google.com/project-65696e12-8def-460e-b29` and `aud` = `project-65696e12-8def-460e-b29` still gets `{"code":"unauthorized"}` from `https://api.faazio.com/categories/rail`, while a legacy HS256 token works. Fix: set `FIREBASE_PROJECT_ID` (and `FCM_PROJECT_ID`) on the Render service to `project-65696e12-8def-460e-b29` and redeploy; a `render.yaml` Blueprint deploy syncs these, a manually-created service does not. Client symptom: the Home/Mart category rail shows a **Retry** chip and logs `[rail] fetchCategoryRail failed ... GatewayHttpError status: 401` in dev. |
| `401` from the gateway after login (config present) | `FIREBASE_PROJECT_ID` value mismatch (wrong/rotated project or a stray quote/space), or the container cannot reach `googleapis.com` to fetch the signing certs. Confirm the project id matches the client `google-services.json`. |
| SMS never arrives | Region policy excludes +91, the number is not a test number, or the free quota is exhausted (Blaze billing required past the quota). |
| No SMS-autofill consent sheet | Google Play Services is missing/outdated, the APK predates the native module, or the retriever was armed **after** the SMS was sent. Type the code manually; rebuild via `gh workflow run android-debug.yml -f app=customer`. |
| Consent approved but the code is not filled | The message must contain a 6-digit run and be surfaced by Play Services. Type the code manually; no `RECEIVE_SMS` permission is involved. |
| Seller signature OTP does not autofill | SMS User Consent is independent of the disposable `faazio-seller-otp` app, so the same consent sheet should appear after "Send OTP". Without Play Services, type the code manually; the Verify button enables at six digits. |
| Seller screen drops back to "Send OTP" after tapping resend | The resend failed, so Firebase discarded the previous pending confirmation; re-send once the network is back rather than typing the old code. |
| "Resend OTP" is tappable but does nothing during verification | Expected: a resend is refused while a verify owns the pending request. Wait for Verify to finish, then resend. |
| `401 otp_unverified` after the seller signature | The bearer token's phone claim does not match the application `contactPhone` (now sent as parsed E.164). Sign in on the shopper account that owns the contact phone and re-verify; a client `otpVerified: true` alone is rejected. |
| International number rejected or mangled on seller onboarding | The seller contact field uses `src/lib/phone.ts` (`libphonenumber-js`). Pick the country first, then type the national number; a leading `+` is parsed as international and preserved even when invalid (never rewritten to `+91`). The `CountryCodePicker` is only shown when the account has no auth phone; if the number came from login it is read-only. Existing login/delivery flows still assume a 10-digit Indian number. |
| Auto-verification never skips the OTP screen | Firebase templates usually cannot use hash-based auto-retrieval; SMS User Consent is the normal fast path. Manual entry remains available. |
| OTP screen shows an error right after a resend | An older `confirm()` resolved against a newer send; pending requests are request-scoped now, so retry once and report if it recurs. |
| Token works but user rows are missing | `checkout.users` upsert needs Postgres; check `/health` → `db:true`. |
