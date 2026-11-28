# Shared auth — phone OTP and portal credentials

**Apps:** customer (`index.js`), delivery partner (`index.delivery.js`), seller partner
(`index.seller.js`), seller web portal (`client/web/platform`).
**Status:** Shipped
**Trigger:** Cold start with no session, session expiry, sign-out, or a portal page load without a
refresh cookie.

## Two authorities (never mix them)

| Authority | Used by | Token | Gateway verifier |
|---|---|---|---|
| Firebase Phone Auth | customer, delivery partner, mobile seller application phone verification | Firebase RS256 ID token | `internal/platform/auth` (Firebase RS256) |
| Portal email/password | seller web portal, seller app WebView, district/super admins | Gateway HS256 portal JWT (`iss=faazio-portal`, `aud=portal`) + opaque refresh | `internal/platform/auth` (portal HS256) |
| Legacy Supabase | migration fallback only | HS256 Supabase JWT | `internal/platform/auth` (legacy fallback) |

The verifier order is **Firebase RS256 → portal HS256 → legacy Supabase HS256**. A portal token can
never be mistaken for a Firebase token (distinct issuer/audience; see
`server/gateway/internal/portal/tokens.go:17-32`).

## Flow A — Firebase phone OTP (customer + delivery)

### Steps

1. The app shows its entry screen (`LoginScreen.tsx` for customer, `PhoneEntryScreen.tsx` for
   delivery). The customer flow is phone → code → a **conditional name**: the phone step comes
   first, and a name is requested after OTP only when the account has none (`GET /profile`
   `hasName: false`). Customer validates with
   `toE164` / `isValidPhone`; delivery uses its local `validPhone` check. Both phone steps
   auto-focus the field and surface device-local **recent numbers** as suggestions. The customer
   screen sends **only** on an explicit "Send code" tap (no auto-send while typing); delivery keeps
   its auto-send after the 10th digit with the explicit button as well.
2. `signInWithPhoneNumber` sends the SMS; the screen enters OTP mode and starts a **30 s resend
   cooldown** (customer `LoginScreen` and delivery `OtpVerify` both). A successful send records the
   number in the recent-numbers suggestion list. When the install cannot pass Play Integrity
   (sideloaded debug/CI APK), `requestSmsCode` (`src/services/firebaseAuth.ts`) retries once with the
   legacy reCAPTCHA v2 web flow after an app-credential rejection — Firebase's default reCAPTCHA
   Enterprise fallback needs a Google Cloud site key the project does not have yet (`FIREBASE_AUTH.md`
   Part 6), so without the retry the send fails and no SMS is dispatched. That browser round-trip is
   user-paced: `withTimeout` pauses its countdown while the app is backgrounded and gives the forced
   reCAPTCHA retry a 120 s budget, so returning from the browser no longer finds a timed-out,
   already-cleared request. On Android the SMS consent sheet is only launched from a resumed
   activity — an SMS that lands while the browser is open is held and shown on return.
3. The user enters the 6-digit code (manual, SMS user-consent, or Firebase auto-retrieval). Both apps
   render an animated 6-segment field driven by a hidden `textContentType="oneTimeCode"` /
   `autoComplete="sms-otp"` input and auto-submit at 6 digits. Auto-retrieval is optional and
   Play Services-owned on Android: `services/playServices.ts` probes availability once under the
   layer-2 splash (in parallel with hydration) and `firebaseAuth` arms the auto-verify watcher only
   when it is confirmed available. On HMS-only Huawei, a de-bloated/custom ROM, a probe error or a
   timeout the app silently skips auto-read (the watcher self-clears after 120 s) and the manual
   field is the path — no prompt, spinner or crash. Delivery uses the same probe.
4. `verifyOtp` returns a Firebase session. Customer `completeLogin` reads `GET /profile` with that
   token: `hasName: true` signs in with the stored name; `hasName: false` holds the session and
   shows the name step, then decodes claims (`role`, `stateCode`, `districtCode`, `sellerId`) into
   `useAuthStore.login` and writes the chosen name through with
   `GatewayClient.updateProfileName()` → `PUT /profile` (`{name}`) so `checkout.users.name` and
   `accounts.profile.name` match what the customer entered. The session is not persisted until the
   name is chosen; the write is best-effort and never blocks the sign-in.
5. The session is persisted in `react-native-keychain` (`services/secureSession.ts`).
6. First authenticated gateway call provisions `checkout.users` (`auth.UserProvisioner`).
7. Customer routes to `LanguageSelection` → `Location` → `MainTabs`. Delivery calls
   `getDeliveryPartnerMe()` and routes by rider status (ACTIVE → `Dashboard`, pending →
   `SubmissionSuccess`, none → `Register`).

### State

- `useAuthStore` (`client/mobile/src/state/authStore.ts`) — session, decoded claims, `login`,
  `updateTokens`, `expireSession`, `logout`, `hydrate`, re-auth helpers. The stored session has no
  expiry field; expiry is event-driven via `expireSession()`.
- `useOnboardingStore` — first-run gate (customer).
- `useDeliveryPartnerStore` — rider projection (delivery).
- `src/lib/recentPhones.ts` — device-local sign-in suggestions (AsyncStorage `faazio:recentPhones`,
  max 5, E.164), shared by both apps; cleared on sign-out via `useAuthStore.logout`.

### Data path

- Firebase Phone Auth is the identity origin; no `@data/*` substitution and no client-side mock
  session in release builds.
- `GatewayClient` sends the Firebase ID token as the bearer. Gateway writes
  `checkout.users` / reads `delivery.delivery_boys`.

### Phone number data use

The phone number is collected solely for **App Functionality** (App Store Connect → App Privacy,
purpose **App Functionality** only):

- Firebase phone OTP authentication — the sole sign-in method for the customer and delivery apps.
- Re-authentication before irreversible account deletion (`sendReauthOtp` / `verifyReauthOtp` →
  `deleteFirebaseIdentity`).
- Checkout pick-up contact (`authStore.user.phone`).
- Seller application `contactPhone`.
- Device-local sign-in suggestions (`src/lib/recentPhones.ts`): previously used numbers are kept
  **on-device only** to pre-fill the next sign-in. They are never logged, never sent to the gateway,
  and cleared on sign-out.

It is **not** used for third-party advertising, the developer's advertising/marketing, analytics,
product personalization, or any other purpose, and is never shared with a data broker or third-party
ad network. First-party ads attribution (`POST /ads/events`) is slot id-based and never uses the
phone number.

### Success / error / empty

- **Success:** authenticated session + role/status routing as above.
- **Invalid/expired code:** inline error; the entered code stays so it can be corrected, and resend
  is allowed. No fabricated session.
- **Unconfigured Firebase:** release builds report OTP unavailable instead of faking a login.
- **Empty:** not applicable (auth requires input).

## Flow B — Portal email/password (seller app + web portal)

### Steps

1. `client/web/platform/middleware.ts` checks the refresh cookie (`faazio_prt` /
   `__Host-faazio_prt`) on `/seller/*` and `/admin/*`; absent → redirect to `/login?next=…`.
   `next` is validated as an internal path, and a target that resolves back to `/login` is
   discarded — otherwise a signed-in user would be navigated to the form again.
2. `/login` calls `signIn` → `POST /api/auth/portal/login` → gateway `POST /auth/portal/login`.
3. The gateway verifies against `admins.portal_users`, then mints an HS256 access JWT
   (`iss=faazio-portal`, `aud=portal`, 15 min) and a rotating opaque refresh family (30 d idle,
   180 d absolute).
4. `setAuthCookies` stores `faazio_pat` and `faazio_prt` as HttpOnly cookies (tokens never exposed
   to JS).
5. `providers.tsx` restores the session on mount; proactive/visibility refresh plus
   `refreshTokensSingleflight` keep it fresh. Concurrent rotation has a 30 s idempotent grace.
   While the restore is in flight (`sessionStatus === "unknown"`), `/login` renders a branded
   loading state and `RoleGate` its loading shell, so a signed-in refresh never flashes the form or
   "Sign in to continue".
6. `RoleGate` + `homeFor()` route to `/seller`, `/admin/district`, or `/admin/super`. The login page
   navigates with `router.replace` (never `push`) and holds its branded loading state whenever a
   session exists, so a just-authenticated user is never left on the form and Back cannot return to it.
7. Logout calls `POST /api/auth/portal/logout`, revokes the refresh family, and clears cookies.
8. The seller partner app is a WebView over the same portal (`SellerPartnerNavigator.tsx` →
   `src/features/seller-partner/screens/SellerWebViewScreen.tsx`); the portal owns the session, so
   there is no native seller auth gate. The native layer-2 splash is held until the WebView reaches
   `/seller/*` (auth resolved) or a 5 s fallback elapses, so a returning seller goes straight to the
   dashboard without the sign-in page flashing first.

### State

- `usePortalStore` + HttpOnly cookies.
- `src/lib/portal/auth.ts` — login/restore/refresh/logout/password.
- `src/lib/portal/server.ts` — cookie contract and refresh singleflight.
- Mobile `GatewayClient.portalLogin/portalRefresh/portalLogout` exist for a future native seller
  surface but are not used by the WebView shell today.

### Data path

- `POST /auth/portal/login|refresh|logout`, `GET /auth/portal/me`, `PUT /auth/portal/password` →
  `admins.portal_users`, `admins.portal_sessions`.
- Every console API call goes through `/api/gateway/[...path]` with the cookies and one retry after
  token rotation.

### Success / error / empty

- **Success:** role home renders live data.
- **Error:** `not_configured` / `gateway_unreachable` / `portal_auth_unavailable` diagnostics on the
  login page; `401` bounces to `/login`.
- **Forced rotation:** non-super users with `must_change` get `403 password_change_required` until
  they change the password.
- **Empty:** honest empty states; no bundled demo rows.

## Flow C — Deep links and push routing

- **Customer:** payment callback returns to `PaymentCallback`; the cart/orders flow verifies payment
  status with the gateway (`GET /orders/{id}/payment-status`).
- **Delivery:** an incoming offer is presented by push/deep link into the `AcceptReject` modal
  (currently no in-app navigation to it — see [KNOWN_GAPS.md](../KNOWN_GAPS.md)).
- **Seller:** push opens the WebView shell; the portal handles the destination.

## Security rules

- Mobile tokens live in `react-native-keychain`; browser tokens are HttpOnly cookies.
- Never log tokens, OTPs, phone numbers, prescriptions, or payment details.
- No mock session or fixture fallback on auth failure; every failure is an honest error state.
- Portal credentials are Argon2id-hashed; forced rotation and lockout live in `internal/portal`.

## Known gaps

- Dev-only placeholder login under `__DEV__` when Firebase is unconfigured (customer) — see
  [KNOWN_GAPS.md](../KNOWN_GAPS.md).
- No native seller auth; the seller app is intentionally a WebView shell over the portal.

## Linked docs

- `docs/RUNBOOKS/FIREBASE_AUTH.md`
- `docs/RUNBOOKS/PORTAL_AUTH.md`
- `docs/architecture/monolith-breakdown.md` (auth verifier ownership)
- `docs/architecture/web-portal.md`
