# Customer onboarding — domain index

**Status:** Shipped
**Routes:** `Onboarding`, `Login`, `LanguageSelection`, `Location`
**Files:** `src/features/onboarding/`, `src/features/auth/`

## Flows

| Flow | Trigger | Doc |
|---|---|---|
| First-run carousel | Cold start with no onboarding flag | This page |
| Phone OTP login | No session, or `Login` route | [phone-otp-login.md](./phone-otp-login.md) |
| Language selection | After successful login | This page |
| Location picker | After language selection | [location-picker.md](./location-picker.md) |

## First-run carousel

1. `AppNavigator` picks `initialRouteName` from `useOnboardingStore.hasSeenOnboarding` and
   `useAuthStore` (`AppNavigator.tsx`).
2. `OnboardingScreen` shows the value carousel.
3. Completing/skipping sets `hasSeenOnboarding` and replaces the route with `Login`.

**State:** `useOnboardingStore` (`src/state/onboardingStore.ts`), persisted.
**Data path:** none (local first-run flag only).
**Success:** `Login`. **Error:** none. **Empty:** not applicable.

## Language selection

1. `LanguageSelectionScreen` lists suggested + all languages, searchable.
2. `handleContinue` writes `useLanguageStore.setLanguage(id)` and navigates to `Location`.
3. Back returns to `Login` when there is no history.

**State:** `useLanguageStore` (`src/state/languageStore.ts`), persisted in AsyncStorage.
**Data path:** static language catalogue in the screen (UI copy, not live data).
**Success:** `Location`. **Error:** none. **Empty:** search with no match shows no results.

## Root gate

| Condition | Initial route |
|---|---|
| Authenticated | `MainTabs` |
| Onboarding seen, no session | `Login` |
| First launch | `Onboarding` |

## Known gaps

- `LoginScreen` has a **`__DEV__`-only** placeholder session when Firebase Auth is unconfigured.
  Release builds refuse to embed a mock-login build (`scripts/configure.js`). See
  [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).
- OTP delivery requires Firebase configuration; see `docs/RUNBOOKS/FIREBASE_AUTH.md`.

## Linked docs

- `docs/architecture/mobile-app.md` (auth flow)
- `docs/RUNBOOKS/FIREBASE_AUTH.md`
- `data/DATA_CONTROL.md`
