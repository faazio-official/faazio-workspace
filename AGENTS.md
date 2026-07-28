# SuperApp Agent Instructions (AGENTS.md)

This file instructs future AI coding agents or assistants on how to build, extend, and manage the **SuperApp** React Native codebase. Follow these guidelines strictly to ensure code quality, modularity, and production-readiness.

---

## 🛑 Critical Rule: Wait For User Intent

**DO NOT build any new screens or pages until the user explicitly requests them.**
The user has initialized the core structure and folder tree, and will provide the exact list of pages (from login to booking systems, shop, etc.) in subsequent turns. Wait for their word.

---

## 🛠️ Codebase Patterns & Rules

### 1. Absolute Path Configuration
- Use the `@/` prefix to import files within the `src/` directory.
- Example: `import { useAuthStore } from '@/state/store';` rather than `import { useAuthStore } from '../../state/store';`.

### 2. State Management Strategy (Zustand)
- All shared states **MUST** live in `src/state/store.ts` (or modular files inside `src/state/` if it scales).
- Keep components presentationally pure. Fetch state using Zustand selectors:
  ```ts
  const user = useAuthStore((state) => state.user);
  ```
- Do not duplicate state within local component states if it is shared.

### 3. Component Extraction Rule
- Keep individual components small and modular.
- Create reusable visual widgets (e.g., custom Buttons, Input fields, Badges, Loaders) under `src/components/`.
- Screen-specific helper widgets should live in subfolders of their respective modules under `src/features/`.

### 4. Navigation Architecture
- The main navigation is handled in `src/navigation/AppNavigator.tsx`.
- Keep Stack and Tab Parameter Lists synchronized inside `AppNavigator.tsx` to ensure complete type-safety.
- Ensure all screens have proper TypeScript typing:
  ```ts
  import { NativeStackScreenProps } from '@react-navigation/native-stack';
  import { RootStackParamList } from '@/navigation/AppNavigator';
  
  type Props = NativeStackScreenProps<RootStackParamList, 'ProductDetail'>;
  ```

### 5. Native Permissions Handling
- When introducing a feature that interacts with native hardware (e.g. upload prescription, camera features, geolocation mapping), you **must**:
  1. Add appropriate description configurations in `app.json` (inside both `ios.infoPlist` and `android.permissions`).
  2. Implement grace checks and user consent dialogs using `expo-image-picker` or standard permissions hooks before booting hardware interfaces.

### 6. HIPAA & E-Commerce Security
- Ensure prescription information and payment details are never saved to unsecure global logs.
- Utilize secure network adapters to proxy files directly to AWS/Google Cloud storage systems.
- Use `expo-secure-store` for sensitive authorization tokens.

### 7. Brand Logo Enforcement
- The official Faazio brand logo must always be used (refer to `/src/assets/logo.svg` or the `<FaazioLogo />` component). Absolutely no raw text placeholders or plain text labels where the brand identity is represented.

### 8. Auto-Edge Full Viewport & Non-Scrollable Layouts
- All app screens (Onboarding, Login, main menus) must be designed to be completely non-scrollable and fit within 100% of the viewport height (`h-screen` or `h-[100dvh]`).
- Spacing, padding, and graphic heights must dynamically scale down to guarantee zero scrollbars on any standard display size.
- Utilize standard edge-to-edge full width and full height layout (auto-edge feature) without artificial device shells, faux status bars, faux notches, and larping device boundaries.

---

## 🗺️ Next Steps Blueprint

When the user specifies the screen names and user flows:
1. **Auth Module (`features/auth`)**: Ready to construct custom screen flows (Login, Sign Up, Verification OTP).
2. **E-Commerce Module (`features/ecommerce`)**: Ready to construct Catalog lists, Product card components, Cart overlays, and custom Checkout screens.
3. **Dinner Booking Module (`features/dinner-booking`)**: Ready to construct Restaurant finders, table reservation calendars, and confirmation logs.
4. **Pharma Module (`features/pharma`)**: Ready to construct medical databases, prescription cameras, and checkout modules.
