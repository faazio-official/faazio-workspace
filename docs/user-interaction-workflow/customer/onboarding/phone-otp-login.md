# Phone OTP login (customer)

**App / route:** customer · `Login` (`src/features/auth/LoginScreen.tsx`)
**Status:** Partial (dev-only mock login seam; see Known gaps)
**Trigger:** **Get Started / Skip** on onboarding, or an account-bound action while browsing as a guest (checkout, favourites, orders, rewards, prescription upload). Sign-out and session expiry return to guest browsing, not this screen.

## Steps

`LoginScreen` has three possible steps (`authStep`: `phone` → `otp` → `name`). The **name** step is
conditional: it appears only after OTP verification when the account has no chosen name yet.
`otpState` is derived from `authStep === 'otp'`. A **Skip** action is visible on the phone step
*and* the OTP step (an `X` closes the screen when it was pushed over a browsing screen by a gated
action). Skipping clears any pending gated action, sets `useAuthFunnelStore` to `location` and
resets the stack to the `Location` picker — there is no guest-home shortcut. The name step has no
skip.

1. **Phone.** A fixed `+91` (India) dial code + phone field — the country is not user-selectable.
   `toE164`/`isValidPhone` validate the number locally. The phone field auto-focuses and shows
   device-local **recent numbers** (tappable suggestions) when empty.
2. An OTP is requested **only** when the user taps "Send code" — there is no auto-send while
   typing, so a half-typed number can never burn an SMS. The button is disabled until the number
   passes `isValidPhone`. Firebase `signInWithPhoneNumber` sends the SMS; the screen advances to
   the OTP step and starts the 30 s resend cooldown (`RESEND_COOLDOWN_S`). A successful send
   records the number in the suggestion list.
   - The send is wrapped in a **20 s hard timeout** in `services/firebaseAuth.ts`
     (`OTP_SEND_TIMEOUT_MS`). If iOS cannot present Firebase's reCAPTCHA fallback (iPad, an
     occluded presenter), the native promise never settles; the timeout clears the pending request,
     releases **Send code** (a `finally` always resets `isSending`), and shows
     "Verification timed out. Check your connection and try again." under the field.
   - A synchronous `sendRef` guard prevents a double tap from starting two native sends before the
     spinner renders.
3. The user enters the 6-digit code (manual, SMS user-consent, or Firebase auto-retrieval) in an
   animated 6-segment field driven by a hidden `oneTimeCode`/`sms-otp` input. Backing out of the
   code step calls `cancelPrimaryOtp()`, dropping the pending confirmation/watch — a late
   auto-retrieval for the abandoned number can never be consumed by the next send, and a phantom
   native session is signed out. It returns to the phone step with the number preserved.
4. `verifyOtp(phoneE164, code)` returns a Firebase session. Before persisting anything,
   `completeLogin` reads `GET /profile` with that freshly verified token
   (`GatewayClient.getProfile(accessToken)`):
   - **`hasName: true`** (returning customer) → decode the ID-token claims (`role`, `stateCode`,
     `districtCode`, `sellerId`) and call `useAuthStore.login` with the profile name. No name step.
   - **`hasName: false`** (first-time customer) → hold the verified session in memory and show the
     **name** step. Nothing is persisted yet, so leaving the step cannot create a signed-in,
     unnamed session.
   - If the profile read fails (gateway offline), the flow falls through to the name step rather
     than blocking sign-in.
5. **Name (new accounts only).** Only the name field is shown (placeholder: "Enter your name").
   Tapping **Continue** (or the keyboard's done action) trims the value, persists the session with
   the chosen name, and then writes it through with `GatewayClient.updateProfileName()`
   (`PUT /profile`, `{name}`) so `accounts.profile`/`checkout.users` carry the customer's choice
   instead of the provisioning placeholder `"Faazio User"`. That write is best-effort: a failure
   never blocks sign-in. Input is capped at 80 characters — the same bound the gateway enforces.
   An empty name sets `nameError` and stays put; the step is not skippable and hardware back is
   consumed.
6. The session is persisted via `react-native-keychain` (`services/secureSession.ts`).
7. Navigation depends on how the screen was opened:
   - first-run sign-in (`route.params?.resume` absent): replace to `LanguageSelection` →
     `Location` → `MainTabs`;
   - guest-gate sign-in (`{ resume: true }`, pushed over a browsing screen): close back to the
     origin screen and run the pending action (e.g. re-open the checkout payment step, toggle the
     favourite, open prescription upload). The guest cart is merged into the account by
     `hydrateUserStores()`.

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
- First authenticated gateway call provisions `checkout.users` + `accounts.profile` with the
  placeholder name; `GET /profile` returns `hasName: false` until a real name is written.
- `GET /profile` (`{ name, hasName, … }`) decides whether the name step is shown. `hasName` is
  derived server-side from the provisioning placeholder, never from a client heuristic.
- A chosen name is persisted by `GatewayClient.updateProfileName()` → `PUT /profile`
  (`{name}`, trimmed, 1–80 characters) which writes both `checkout.users.name` and
  `accounts.profile.name`; an `@data/*` fixture is never substituted on failure.
- No `@data/*` substitution; there is no client-side mock session in release builds.

## Success / error / empty

- **Success:** first-run → `LanguageSelection` → `Location` → `MainTabs`; guest gate → the origin
  screen with the gated action resumed.
- **Returning customer:** OTP verify → `GET /profile` `hasName: true` → sign in directly, no name
  prompt.
- **Guest skip:** phone/OTP **Skip** → `Location` (required, no skip); a confirmed origin sets the
  funnel stage to `home` and opens `MainTabs` with no account. The guest is asked to sign in again
  only when an account-bound action needs a session.
- **App killed mid-funnel:** nothing is persisted unless sign-in completed, so the next launch
  reopens the phone step (welcome skipped) or the `Location` picker (phone auth skipped,
  `useAuthFunnelStore`).
- **Empty name:** the name step shows "Enter your name" and does not advance (the name step is the
  only place that message can appear).
- **Invalid phone:** the send button stays disabled until `isValidPhone`, and a rejected send shows
  the mapped message under the field.
- **Invalid/expired code:** inline error, shake animation; the entered code remains so the user can
  correct it, and resend is available. Firebase auth codes are mapped to user copy via
  `src/lib/otpError.ts` — the raw `[auth/<code>] …` SDK text is never shown. An expired session
  (`auth/session-expired`) renders "That code has expired. Tap Resend OTP to get a new one." and
  clears the dead pending request so only a fresh send can succeed.
- **Timed-out send/verify:** the 20 s hard timeout rejects with `faazio/otp-timeout`, renders
  "Verification timed out. Check your connection and try again.", clears the dead pending request,
  and releases the button (`isSending`/`isVerifying` always reset in `finally`/`catch`). The user
  can retry Send code, or Resend on the code step.
- **Profile read fails after OTP:** sign-in continues to the name step (a returning customer may be
  asked again while the gateway is unreachable) — the flow never fabricates a name.
- **Unconfigured Firebase:** release build refuses to embed the mock-login config; the screen
  reports that OTP is unavailable rather than fabricating a session.
- **Empty:** not applicable (auth requires input).

## Known gaps

- Dev-only placeholder login exists under `__DEV__` when Firebase is unconfigured
  (`LoginScreen.tsx` `submitOtp`). It cannot read a profile with its fake token, so it always shows
  the name step. It is not a release path; see [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).
- **iOS must configure Firebase natively.** RNFB does not auto-configure the default app on iOS, so
  `ios/Faazio/AppDelegate.swift` calls `FirebaseApp.configure()` (`FirebaseCore`). If that call is
  missing, `getApps()` is empty, `firebaseAuthConfigured()` is false, the placeholder path above is
  used instead of the real OTP, and its fake token 401s → `expireSession` → back to `Login` (a
  login loop). See `docs/RUNBOOKS/FIREBASE_AUTH.md` → "iOS native init".
- Re-auth for irreversible actions uses the same phone OTP path (`sendReauthOtp` /
  `verifyReauthOtp` in `authStore`).
- A failed `PUT /profile` name write is silent for the customer: the session still carries the
  typed name, but the server copy keeps the placeholder (so the next sign-in asks again) until the
  write succeeds. There is no profile-name editor in the app yet.

## Linked docs

- `docs/RUNBOOKS/FIREBASE_AUTH.md`
- `docs/architecture/mobile-app.md`
- `docs/architecture/monolith-breakdown.md` (auth verifier ownership)
