# Appearance (light / dark / auto)

**Status:** Shipped mechanism (default **Light**, `Auto` follows the device) — **Partial** dark
coverage: the themed shell + Account surfaces are converted; screens that still render light
literals are tracked in [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).
**Routes:** `MainTabs` → `You` / pushed `You` → `Theme` (`features/profile/ThemeScreen.tsx`)
**Trigger:** My Account → **Preferences → Appearance**.

## Flow

1. **Entry.** `AccountView` renders a client-side **Preferences → Appearance** row after the
   server-driven `GET /account-nav` groups (the server catalog is not modified). Its subtitle shows
   the current preference (`Light`, `Dark`, or `Auto — Dark|Light`).
2. **Tap.** The row navigates to the typed root-stack route `Theme`.
3. **Select.** `ThemeScreen` shows three radio rows — **Light**, **Dark**, **Auto** — with the
   current selection checked and a caption explaining Auto.
4. **Persist.** `setThemeMode(mode)` updates `themeStore` and writes AsyncStorage key
   `faazio.theme` (same preference name as the web console; mobile uses AsyncStorage, web uses
   localStorage). No gateway call.
5. **Resolve.** `useThemeMode()` collapses the preference to an effective `light | dark`:
   `auto` reads the live device scheme (`useColorScheme`), explicit modes pin the app. It also calls
   `Appearance.setColorScheme(themeMode | 'unspecified')` so native alerts, keyboards, and Android
   `DayNight` match the app.
6. **Apply.** `App.tsx` builds the React Navigation theme from the resolved palette and paints the
   `StatusBar`, root background, offline blocker, and navigator. The tab bar, `Screen`,
   `SplashFallback`, `OfflinePage`, `ErrorBoundary`, and Account/Appearance surfaces read the same
   palette. Dark tokens live in `src/theme/theme.ts` (`darkPalette`).

## Default and precedence

- **Default is Light.** `themeStore` starts at `DEFAULT_THEME_MODE = 'light'`; an empty, unreadable,
  or unknown stored value keeps Light.
- Stored explicit `light` / `dark` wins over the OS.
- Stored `auto` follows the OS live; a null/unknown scheme at startup resolves to Light.
- Hydration runs in the startup gate (`App.tsx` `Promise.all` with auth/language/onboarding, 4 s
  timeout) so a persisted choice is applied before the splash ends.

## State

- `useThemeStore` — `themeMode`, `hydrated`, `setThemeMode`, `hydrate`.
- `useThemeMode()` — `{ themeMode, effectiveMode, palette, barStyle, setThemeMode }`.

## Data path

- **None.** Appearance is device-local only (`AsyncStorage` `faazio.theme`); it is not sent to the
  gateway and has no Supabase table. iOS no longer forces `UIUserInterfaceStyle = Light`, so `auto`
  can observe the system.

## Success / error / empty

- **Success:** the selected mode is saved, applied immediately, and survives a cold start.
- **Error:** AsyncStorage read/write failure is non-fatal — the app stays on Light; a failed write
  is best-effort and does not block the UI.
- **Empty:** no stored preference = Light.

## Known gaps

- Dark mode is **partial**: Home, Mart/Food/Pharma sub-apps, search, orders, modals and other
  screens still carry light colour literals; they need per-screen token conversion. Tracked in
  [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).
- Native launch/splash artwork stays brand blue in both themes (intentional).
- Delivery and seller roots are separate entry points and remain light; this setting is
  customer-app only.

## Linked docs

- `docs/architecture/mobile-app.md` → State (`themeStore`) and UI foundations (`theme/theme.ts`)
- `docs/UI_DESIGN_SYSTEM.md` §7 (web theme contract) — the mobile contract mirrors its
  `auto|light|dark` preference model.
