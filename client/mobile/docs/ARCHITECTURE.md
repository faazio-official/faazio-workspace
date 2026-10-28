# Faazio Mobile — Architecture

> **Stale-content replacement.** The canonical, always-up-to-date deep dive now lives at
> root `docs/architecture/mobile-app.md`. This file is a short pointer + accurate summary
> for readers who land here from inside `client/mobile/`.

## Stack (accurate)

| Layer | Choice |
|---|---|
| Framework | Bare React Native (committed `android/` + `ios/`) |
| React Native | **0.86.3** (New Architecture, Hermes) |
| React | **19.2.3** |
| State | **Zustand** (`src/state/`) |
| Navigation | React Navigation — Native Stack + Bottom Tabs |
| Data | `@data/*` (root `data/`, see `data/DATA_CONTROL.md`) |

## Source layout

```
client/mobile/src/
├── App.tsx                 # root — providers + AppNavigator
├── components/             # global atomic UI (+ shared/ primitives)
├── features/               # 18 vertical modules (auth, cart, catalog,
│                           #   delivery-partner, ecommerce, favourites, food, home,
│                           #   onboarding, pharma, product, profile, rewards, search,
│                           #   seller-onboarding, seller-partner, sub-app)
├── navigation/             # AppNavigator, MainTabs, FoodStack, types
├── services/               # GatewayClient, logout, secureSession, categoryRail
├── state/                  # Zustand stores (auth, bloodDonor, cart, deliveryPartner,
│                           #   favorite, foodFilter, language, location, orders, pharma,
│                           #   rewards, search, ui, vendorRating)
├── theme/                  # brandTokens, fonts, sectorVisuals
└── utils/                  # responsive (hs/vs/ms/wp/hp)
```

## Key rules

- Shared state **only** in Zustand stores under `src/state/` (no duplicate shared state).
- All routes typed in `src/navigation/AppNavigator.tsx`; screens use `NativeStackScreenProps`.
- Cross-sub-app access **only via Home** — enforced by `npm run check:boundaries`.
- The app is server-first (`USE_GATEWAY=true`): every read/write is remote via `GatewayClient`;
  `@data/*` fixtures are never substituted at runtime (see `docs/architecture/data-layer-sdui.md`).

## See also

- **Root deep dive (canonical):** `docs/architecture/mobile-app.md`
- Data layer: `docs/architecture/data-layer-sdui.md`
- Getting started: `docs/DEVELOPER_ONBOARDING.md`
