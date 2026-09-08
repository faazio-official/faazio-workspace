# Mobile App Architecture Deep-Dive

> **Status:** LIVE · **Scope:** `client/mobile/` — the React Native (Expo) SuperApp.

## Stack

| Layer | Choice |
|---|---|
| Framework | Expo **SDK 57** |
| React Native | **0.86.3** (New Architecture, Hermes) |
| React | **19.2.3** |
| State | **Zustand** (`src/state/`) |
| Navigation | React Navigation — Native Stack + Bottom Tabs |
| Lists | `@shopify/flash-list` |
| Data | `@data/*` (root `data/`, see `data-layer-sdui.md`) |

## Why this exists

This is the **only live runtime**. The root Vite web app was removed (see git history);
all active product work ships through this app. It is a multi-sector "superapp":
mart, grocery, food, pharma, plus cross-cutting home/search/cart/profile.

## Module map (`src/`)

```
src/
├── App.tsx                     # root — providers + AppNavigator
├── components/                 # global atomic UI (AppText, FaazioLogo, shared/, …)
│   └── shared/                 # 13 reusable primitives (ProductCardBase, StoreCardBase, Screen, …)
├── features/                   # vertical feature modules (14)
├── navigation/                 # AppNavigator, MainTabs, FoodStack, types
├── services/                   # GatewayClient, logout, secureSession, categoryRail
├── state/                      # Zustand stores (10)
├── theme/                      # brandTokens, fonts, sectorVisuals
└── utils/                      # responsive (hs/vs/ms/wp/hp)
```

### Features (`src/features/`)

`auth` · `cart` · `catalog` · `dinner-booking` · `ecommerce` · `favourites` · `food` ·
`home` · `onboarding` · `pharma` · `product` · `profile` · `search` · `sub-app`

`dinner-booking` is a scaffold (README) — not yet shipped as a full flow.

### State (`src/state/`)

| Store | Purpose |
|---|---|
| `authStore` | Session, login payload, auth state |
| `cartStore` | Cart items, quantity, totals |
| `favoriteStore` | Favourites (ids) |
| `bookingStore` | Dinner bookings |
| `foodBookingStore` | Food bookings |
| `pharmaStore` | Prescriptions |
| `searchStore` | Search state/history |
| `languageStore` | Selected language |
| `uiStore` | Sub-app id (`FA_MART`/`FOOD`/`GROCERY`/`PHARMA`), tab name |

### Services (`src/services/`)

- `api/GatewayClient.ts` — intended single data surface; **not yet wired** (see data doc).
- `secureSession.ts` — tokens via `expo-secure-store` (never AsyncStorage for secrets).
- `logout.ts` — clears auth + cart + favourites + search + pharma stores.
- `categoryRail.ts` — builds category cards from `@data/categories/masterCategories`.

## Navigation graph

```
AppNavigator (root native stack)
├── Onboarding ── Login ── LanguageSelection ── Location
├── MainTabs (bottom tabs)
│   ├── Home · Categories · Favourites · You   (+ central Cart pill)
├── SubApp (generic sub-app wrapper)
├── FoodApp (FoodStack)
├── ProductDetail · Search · Cart · PaymentOptions
├── MasterCategories
├── You · UserDetails · SavedAddresses · MyOrders · OrderDetails
```

Entry is `Onboarding` (or `MainTabs` when authenticated) — decided in `AppNavigator.tsx`
from `useAuthStore.isAuthenticated`.

## Boundary enforcement

- **Home is the sanctioned cross-sub-app consumer** — only Home may import another sub-app's
  `cards/*` or `@data/<other>/*`.
- Sub-app screens may import only their own domain + shared primitives/theme/state.
- Enforced by `dependency-cruiser` via `npm run check:boundaries` (config:
  `.dependency-cruiser.cjs`). A violation fails the check.

## Build & patch system

- `patch-package` (`postinstall`) applies the `@shopify/react-native-skia` patch — mandatory.
- `react-native-svg-transformer` + `sharp` for asset optimization.
- `babel-plugin-transform-remove-console` trims logs in production builds.

## Honest limitations

- **All data is mock** — served from `@data/*`, not a backend (see `data-layer-sdui.md`).
- **`GatewayClient` is unwired** — screens still read legacy `@data/*` fixtures.
- **Duplicated mock data** in a few screens (`PharmaScreen`, `FoodScreen` booking dishes,
  `ProductDetailView`) — canonical copies exist under `@data/` marked `@unused`; de-dup is
  a tracked priority (see `data/DATA_CONTROL.md` "Known Gaps").
- `ts:check` currently requires `--ignoreDeprecations 6.0` due to a pre-existing `baseUrl`
  deprecation in `tsconfig.json` (unrelated to feature work).

## Verification workflow

```bash
cd client/mobile
npm run ts:check            # typecheck
npm run check:boundaries    # dependency-cruiser
adb devices && npm run android
```
