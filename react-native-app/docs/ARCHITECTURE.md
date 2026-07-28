# SuperApp Architecture Documentation

Welcome to the **SuperApp** architecture reference guide. This document details the technical setup, directory structures, state flows, and design paradigms designed to scale this cross-platform customer-facing product (E-Commerce, Dinner Booking, Pharma).

---

## Technical Overview

- **Framework:** React Native + Expo (SDK 51)
- **Language:** TypeScript (Strict Mode)
- **State Management:** Zustand (Ultra-lightweight, decoupled from React lifecycle)
- **Navigation:** React Navigation (Native Stack + Bottom Tabs)
- **UI & Themes:** Built with custom clean layouts optimized for native rendering
- **Platform support:** iOS (App Store) & Android (Play Store)

---

## Directory Design

The codebase utilizes a modular feature-driven structure:

```
react-native-app/
├── App.tsx                     # Main app configuration (Navigation, Providers)
├── app.json                    # Expo configurations & metadata (Bundle IDs, Permissions)
├── tsconfig.json               # Type system configurations
├── package.json                # Project dependencies
├── docs/                       # Comprehensive build, release & development docs
│   ├── ARCHITECTURE.md         # Architecture blueprint (this file)
│   ├── DEVELOPMENT_SETUP.md    # Local environment bootstrap guide
│   ├── PLAYSTORE_RELEASE.md    # Step-by-step Google Play production release manual
│   └── APPSTORE_RELEASE.md     # Step-by-step Apple App Store production release manual
└── src/                        # Core application code
    ├── api/                    # Networking layer (Axios/Fetch clients, API endpoints)
    ├── components/             # Reusable global atomic UI components (Buttons, Inputs, Cards)
    ├── constants/              # Style guidelines, theme variables, localized copies
    ├── features/               # Vertical feature modules (contain UI & feature-specific hooks)
    │   ├── auth/               # Login, OTP verification, password resets
    │   ├── ecommerce/          # Storefront, product cards, inventory, cart, checkout
    │   ├── dinner-booking/     # Restaurant discoverability, calendars, reservations
    │   └── pharma/             # Medicine directories, prescription uploads, dosage reminders
    ├── navigation/             # AppNavigator, TabNavigator, stack definitions, type safety
    ├── state/                  # Zustand store partitions (Auth, Cart, Booking, Pharma)
    └── utils/                  # Helper math, dates, camera validators, formatting
```

---

## Module Division

### 1. Unified Authentication (`features/auth`)
- Supports password-less OTP flow, classic login/signup, and social auth hookups.
- Globally accessible authorization tokens cached using SecureStore.

### 2. E-Commerce Marketplace (`features/ecommerce`)
- Dynamic product listings with virtual list rendering (`FlashList` or `FlatList` with optimization).
- Multi-tier categorization (General, Deals, Express delivery).
- Integrated cart and multi-stage secure checkout flow.

### 3. Fine Dinner Booking (`features/dinner-booking`)
- Restaurant searching with live calendar booking blocks.
- Real-time guest quota tracking.
- Interactive seat/table mapping overlays.

### 4. Certified Pharmaceutical Purchases (`features/pharma`)
- Secure camera interface for prescription image uploading.
- Certified drug search indexes with dosage alerts.
- Dedicated prescription review queues managed via backend approval WebSockets.

---

## State Flow Strategy

We implement **Zustand** stores in `src/state/store.ts` to manage distinct domains:

1. **`useAuthStore`**: Controls user session state, credentials, and access roles.
2. **`useCartStore`**: Handles add, update, remove, and price calculation logic for the e-commerce store.
3. **`useBookingStore`**: Manages reservation parameters, schedules, and active bookings history.
4. **`usePharmaStore`**: Logs prescription upload states, approvals, and medical order queues.

```
       [User Interaction UI]
                 │
                 ▼
     [Zustand Domain Stores] ───► [SecureStorage Sync (Tokens)]
                 │
                 ▼
     [Network Gateway / Axios]
                 │
                 ▼
       [Secure Backend APIs]
```

---

## Security Guidelines

- **Sensitive Configurations:** Store API keys and endpoint domains in `.env` files and load them using `react-native-config` or `expo-constants`. Never hardcode secrets.
- **Client Storage:** Sensitive user session keys and tokens **MUST** be written using `expo-secure-store` or native keychain interfaces, NOT asynchronous standard `AsyncStorage`.
- **Pharma HIPAA Compliance:** Ensure prescription files are loaded directly to secure storage vaults (e.g. Encrypted AWS S3 Buckets) over SSL; do not cache images on open local file directories.
