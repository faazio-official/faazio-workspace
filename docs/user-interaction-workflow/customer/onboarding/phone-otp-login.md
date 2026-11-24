# Phone OTP login (customer)

**App / route:** customer · `Login` (`src/features/auth/LoginScreen.tsx`)
**Status:** Partial (dev-only mock login seam; see Known gaps)
**Trigger:** Cold start with no session, session expiry, or sign-out.

## Steps

`LoginScreen` is a three-step flow (`authStep`: `name` → `phone` → `otp`); `otpState` is derived
from `authStep === 'otp'`.

1. **Name.** Only the name field is shown (placeholder: "Enter your name"). Tapping **Continue**
   (or the keyboard's next action) trims the value and advances to the phone step; an empty name
   sets `nameError` and stays put. Input is capped at 80 characters — the same bound the gateway
   enforces.
2. **Phone.** A fixed `+91` (India) dial code + phone field — the country is not user-selectable.
   `toE164`/`isValidPhone` validate the number locally. The phone field auto-focuses and shows
   device-local **recent numbers** (tappable suggestions) when empty. The chevron and Android
   hardware back return to the name step with the typed name preserved (name/phone errors are
   cleared on the transition).
3. An OTP is requested **only** when the user taps "Send code" — there is no auto-send while
   typing, so a half-typed number can never burn an SMS. The button is disabled until the number
   passes `isValidPhone`. Firebase `signInWithPhoneNumber` sends the SMS; the screen advances to
   the OTP step and starts the 30 s resend cooldown (`RESEND_COOLDOWN_S`). A successful send
   records the number in the suggestion list. `requestOtp` reads the live `name` (it is in the
   `useCallback` dependency list) — a missing dependency previously froze the name at `''` and
   rejected every send.
4. The user enters the 6-digit code (manual, SMS user-consent, or Firebase auto-retrieval) in an
   animated 6-segment field driven by a hidden `oneTimeCode`/`sms-otp` input. Backing out of the
   code step calls `cancelPrimaryOtp()`, dropping the pending confirmation/watch — a late
   auto-retrieval for the abandoned number can never be consumed by the next send, and a phantom
   native session is signed out. It returns to the phone step.
5. `verifyOtp(phoneE164, code)` returns a Firebase session. `completeLogin` decodes the ID-token
   claims (`role`, `stateCode`, `districtCode`, `sellerId`) and calls `useAuthStore.login` with
   `name: <typed name>` (falling back to `displayName(session.user)` only if it is empty).
   The typed name is then written through with `GatewayClient.updateProfileName()`
   (`PUT /profile`, `{name}`) so `accounts.profile`/`checkout.users` carry the customer's own
   choice instead of Firebase's phone-derived fallback. That write is best-effort: a failure never
   blocks the sign-in.
6. The session is persisted via `react-native-keychain` (`services/secureSession.ts`).
7. Navigation replaces to `LanguageSelection`.

## State

- `useAuthStore` (`src/state/authStore.ts`) — session, user, decoded claims, `expireSession`,
  re-auth helpers.
- `useOnboardingStore` — first-run gate.
- `useLanguageStore` / `useLocationStore` — subsequent onboarding steps.
- `src/lib/recentPhones.ts` — device-local sign-in suggestions (AsyncStorage, cleared on sign-out).

## Data path

- Firebase Phone Auth (`@react-native-firebase/auth`) is the identity origin.
- The Firebase ID token is the bearer sent to the gateway; `internal/platform/auth` verifies it
  (Firebase RS256 → portal HS256 → legacy Supabase HS256 fallback).
- First authenticated gateway call provisions `checkout.users` (`auth.UserProvisioner`).
- The typed name is then persisted by `GatewayClient.updateProfileName()` → `PUT /profile`
  (`{name}`, trimmed, 1–80 characters) which writes both `checkout.users.name` and
  `accounts.profile.name`; an `@data/*` fixture is never substituted on failure.
- No `@data/*` substitution; there is no client-side mock session in release builds.

## Success / error / empty

- **Success:** `LanguageSelection`, then `Location`, then `MainTabs`.
- **Empty name:** the name step shows "Enter your name" and does not advance (the name step is the
  only place that message can appear).
- **Invalid phone:** the send button stays disabled until `isValidPhone`, and a rejected send shows
  the mapped message under the field.
- **Invalid/expired code:** inline error, shake animation; the entered code remains so the user can
  correct it, and resend is available. Firebase auth codes are mapped to user copy via
  `src/lib/otpError.ts` — the raw `[auth/<code>] …` SDK text is never shown. An expired session
  (`auth/session-expired`) renders "That code has expired. Tap Resend OTP to get a new one." and
  clears the dead pending request so only a fresh send can succeed.
- **Unconfigured Firebase:** release build refuses to embed the mock-login config; the screen
  reports that OTP is unavailable rather than fabricating a session.
- **Empty:** not applicable (auth requires input).

## Known gaps

- Dev-only placeholder login exists under `__DEV__` when Firebase is unconfigured
  (`LoginScreen.tsx` `submitOtp`). It is not a release path; see
  [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).
- **iOS must configure Firebase natively.** RNFB does not auto-configure the default app on iOS, so
  `ios/Faazio/AppDelegate.swift` calls `FirebaseApp.configure()` (`FirebaseCore`). If that call is
  missing, `getApps()` is empty, `firebaseAuthConfigured()` is false, the placeholder path above is
  used instead of the real OTP, and its fake token 401s → `expireSession` → back to `Login` (a
  login loop). See `docs/RUNBOOKS/FIREBASE_AUTH.md` → "iOS native init".
- Re-auth for irreversible actions uses the same phone OTP path (`sendReauthOtp` /
  `verifyReauthOtp` in `authStore`).
- A failed `PUT /profile` name write is silent for the customer: the session still carries the
  typed name, but the server copy keeps the previous value until the account screen changes it
  (there is no profile-name editor in the app yet).

## Linked docs

- `docs/RUNBOOKS/FIREBASE_AUTH.md`
- `docs/architecture/mobile-app.md`
- `docs/architecture/monolith-breakdown.md` (auth verifier ownership)
