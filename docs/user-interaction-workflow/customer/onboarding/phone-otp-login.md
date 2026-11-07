# Phone OTP login (customer)

**App / route:** customer · `Login` (`src/features/auth/LoginScreen.tsx`)
**Status:** Shipped
**Trigger:** Cold start with no session, session expiry, or sign-out.

## Steps

1. `LoginScreen` renders the country picker + phone field. `toE164`/`isValidPhone` validate locally.
2. User requests an OTP. Firebase `signInWithPhoneNumber` sends the SMS; the screen enters OTP mode
   and starts the 30 s resend cooldown (`RESEND_COOLDOWN_S`).
3. User enters the 6-digit code (manual, SMS user-consent, or Firebase auto-retrieval).
4. `verifyOtp(phoneE164, code)` returns a Firebase session. `completeLogin` decodes the ID-token
   claims (`role`, `stateCode`, `districtCode`, `sellerId`) and calls `useAuthStore.login`.
5. The session is persisted via `react-native-keychain` (`services/secureSession.ts`).
6. Navigation replaces to `LanguageSelection`.

## State

- `useAuthStore` (`src/state/authStore.ts`) — session, user, decoded claims, `expireSession`,
  re-auth helpers.
- `useOnboardingStore` — first-run gate.
- `useLanguageStore` / `useLocationStore` — subsequent onboarding steps.

## Data path

- Firebase Phone Auth (`@react-native-firebase/auth`) is the identity origin.
- The Firebase ID token is the bearer sent to the gateway; `internal/platform/auth` verifies it
  (Firebase RS256 → portal HS256 → legacy Supabase HS256 fallback).
- First authenticated gateway call provisions `checkout.users` (`auth.UserProvisioner`).
- No `@data/*` substitution; there is no client-side mock session in release builds.

## Success / error / empty

- **Success:** `LanguageSelection`, then `Location`, then `MainTabs`.
- **Invalid/expired code:** inline error, shake animation, OTP field cleared; user can retry/resend.
- **Unconfigured Firebase:** release build refuses to embed the mock-login config; the screen
  reports that OTP is unavailable rather than fabricating a session.
- **Empty:** not applicable (auth requires input).

## Known gaps

- Dev-only placeholder login exists under `__DEV__` when Firebase is unconfigured
  (`LoginScreen.tsx` `submitOtp`). It is not a release path; see
  [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).
- Re-auth for irreversible actions uses the same phone OTP path (`sendReauthOtp` /
  `verifyReauthOtp` in `authStore`).

## Linked docs

- `docs/RUNBOOKS/FIREBASE_AUTH.md`
- `docs/architecture/mobile-app.md`
- `docs/architecture/monolith-breakdown.md` (auth verifier ownership)
