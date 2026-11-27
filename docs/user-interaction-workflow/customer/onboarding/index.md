# Customer onboarding — domain index

**Status:** Partial (dev-only placeholder login seam)
**Routes:** `Onboarding`, `Login`, `LanguageSelection`, `Location`
**Files:** `src/features/onboarding/`, `src/features/auth/`

## Flows

| Flow | Trigger | Doc |
|---|---|---|
| First-run carousel | Cold start with no onboarding flag | This page |
| Guest browsing (no account) | Skip on onboarding/login, sign-out, revoked session, or a signed-out cold start after onboarding | [guest-browsing.md](./guest-browsing.md) |
| Phone OTP login | Login route from onboarding "Get Started", or an account-bound action as a guest | [phone-otp-login.md](./phone-otp-login.md) |
| Language selection | After successful login | This page |
| Location picker | After language selection | [location-picker.md](./location-picker.md) |
| Service-area gate | Origin outside an enabled coverage district | [service-area-gate.md](./service-area-gate.md) |

## First-run carousel

1. `AppNavigator` picks `initialRouteName` from `useOnboardingStore.hasSeenOnboarding`,
   `useAuthStore` and the persisted funnel stage in `useAuthFunnelStore`
   (`src/state/authFunnelStore.ts`, key `faazio:funnel:stage`) — `AppNavigator.tsx`.
2. `OnboardingScreen` shows the value carousel.
3. **Skip** (and **Get Started**) set `hasSeenOnboarding` and open the mandatory sign-in funnel:
   the stack is reset to `Login` (phone step) with `faazio:funnel:stage = auth`. There is no
   guest-home shortcut from the carousel any more.
4. On `Login`, **Skip** exists on the phone and OTP steps only and advances *forward* to
   `Location` (`faazio:funnel:stage = location`); the post-verification name step is not
   skippable. On `Location` there is no skip at all — see location-picker.md.
5. Because the funnel stage persists, closing the app mid-funnel and reopening lands on the step
   that was last reached: the phone-auth screen after a typed-but-unsubmitted name (no session is
   written until the name is saved), or the location picker after skipping phone auth. A guest who
   confirmed a location has `stage = 'home'` and cold-starts on `MainTabs`. Sign-in, a completed
   funnel or a sign-out reset the stage.

**State:** `useOnboardingStore` (`src/state/onboardingStore.ts`) and `useAuthFunnelStore`
(`src/state/authFunnelStore.ts`), both persisted.
**Data path:** none (local first-run flag + funnel stage only).
**Motion:** each step enters on the entrance curve (240ms) and travels on a short arc
(`OnboardingScreen`); Reduce Motion replaces the slide/arc with a short cross-fade.
**Success:** `Login` phone step (Skip / Get Started). **Error:** none. **Empty:** not applicable.

## Language selection

1. **Tamil has been removed.** `LanguageSelectionScreen` now offers only **English (default, pre-selected)**.
2. Removed Tamil option from languages.ts (font + native registration issue prevented proper rendering).
3. `handleContinue` writes `useLanguageStore.setLanguage(id)` and navigates to `Location`.
4. Back returns to `Login` when there is no history.

**State:** `useLanguageStore` (`src/state/languageStore.ts`), persisted in AsyncStorage; the value is
read app-wide (fonts via `AppText`/`AppTextInput`, nav theme, catalog labels via
`src/lib/localizedText.ts`).
**Data path:** static language catalogue in the screen (UI copy, not live data). Choosing `ta` makes
every screen prefer the server-authored Tamil copy (`nameTa`/`descTa`) and fall back to English when
a translation is empty.
**Success:** `Location`. **Error:** none. **Empty:** not applicable (two fixed options).

## Root gate

| Condition | Initial route |
|---|---|
| Authenticated, `useLocationStore.status === 'idle'` (no usable origin yet) | `Location` (primer step) |
| Authenticated, origin known (`ready` / `denied` / `blocked`) **and** coverage serviceable | `MainTabs` (denied/blocked show the Home nudge banner) |
| Authenticated, origin known but outside enabled district coverage | App-level `ServiceAreaBlockedPage` (no navigator mounted) |
| Onboarding seen, no session, funnel stage `auth` | `Login` (phone step — resumed mid-funnel) |
| Onboarding seen, no session, funnel stage `location` | `Location` (resumed mid-funnel) |
| Onboarding seen, no session, funnel stage `home` / no stage stored | `MainTabs` (legacy guests keep the catalogue) |
| First launch | `Onboarding` (Skip / Get Started → `Login`) |

The authenticated branch waits for the persisted location to hydrate (3 s bound) before choosing, so
a returning user with no origin is not stranded on an empty Home tab. On a cold start it also holds
the splash for the first coverage decision (3 s bound) so a returning user outside coverage never
flashes `MainTabs`. The signed-out branch also waits (same 3 s bound) for the funnel stage to
hydrate before choosing. Guests are never gated on district coverage; checkout is still validated
server-side. See
[guest-browsing.md](./guest-browsing.md), [location-picker.md](./location-picker.md) and
[service-area-gate.md](./service-area-gate.md).

## Known gaps

- `LoginScreen` has a **`__DEV__`-only** placeholder session when Firebase Auth is unconfigured.
  Release builds refuse to embed a mock-login build (`scripts/configure.js`). See
  [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).
- OTP delivery requires Firebase configuration; see `docs/RUNBOOKS/FIREBASE_AUTH.md`.

## Linked docs

- [`service-area-gate.md`](./service-area-gate.md) (enabled-district hard gate)
- `docs/architecture/mobile-app.md` (auth flow)
- `docs/RUNBOOKS/FIREBASE_AUTH.md`
- `data/DATA_CONTROL.md`
