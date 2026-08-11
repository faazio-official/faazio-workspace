# Architecture.md — Faazio SuperApp

> **Concern:** high-level technical architecture for the two real runtimes — the **React Native (Expo) mobile app** (`client/mobile/`) and the **future Go Chi SDUI backend** (`server/`). Modular, layered, and trackable so every concern has one owner and nothing is silently re-invented (or duplicated) because it "was modular."

## Runtime boundaries (what is live vs frozen vs planned)
| Surface | Stack | Status |
|---|---|---|
| `(root)` Vite web app | React + Vite | **FROZEN reference.** Old UI reference. Never edit, lint, typecheck, or build. |
| `client/mobile/` | React Native (Expo SDK 54) + TypeScript + Zustand | **LIVE.** All active work. |
| `data/` | Typed entity arrays (SDUI source of truth) | **LIVE (enterprise-controlled).** Read-only for the app; consumed via `@data/*`. |
| `server/` | Go Chi SDUI backend | **PLANNED.** Placeholder directory only. |
| `data/DATA_CONTROL.md` | Ownership + mock/seed/static inventory | **LIVE.** Authoritative ownership map. |

---

## 1. Mobile app (`client/mobile/`)

### Layering (import direction top→down)
```
screens (src/features/<module>/)
   ↓
domain logic (idempotent helpers, filters)
   ↓
state (src/state/ — Zustand stores, selectors)
   ↓
presentation primitives (src/components/shared/, src/theme/)
   ↓
`@data/*` (root data/)  ·  `expo`/`react-native` APIs
```
- A module may only import **down** the stack, never sideways into another module's internals.
- Cross-module data access is **Home-only**, enforced by `dependency-cruiser` (`npm run check:boundaries`).

### Module map (`src/features/`)
| Feature | Domain | Local helper folder |
|---|---|---|
| onboarding / auth | first-run flow, login, OTP | `features/auth` |
| home | aggregated feed; sanctioned cross-module consumer | `features/home/sections/*` |
| ecommerce | mart + grocery rails, catalog | `features/ecommerce/*-home/` |
| food | restaurant/dish browsing, booking | `features/food/` |
| dinner-booking | table reservations | `features/dinner-booking/` |
| pharma | medical database, prescriptions | `features/pharma/` |
| product | product detail | `features/product/` |
| cart / favourites / search / catalog / profile | cross-cutting utilities | their own folders |

### Modularity rule (prevents LLM duplication)
- Every reusable concern declares **one canonical owner** (component, helper, hook, store, or `@data` entry).
- Before adding code, search for an existing owner: `@/components/shared/*`, `src/state/*`, `src/utils/*`, `@data/*`.
- If a service/module "feels missing," first check whether a modular owner already exists instead of re-creating it (duplication is the failure mode of over-modularization).
- Per-sub-app data ownership and known duplication gaps: `data/DATA_CONTROL.md`.

### State
- Shared state lives **only** in Zustand stores under `src/state/`. Components stay presentational; read through selectors. No local duplicate of shared state.

### Navigation
- All routes + param lists typed in `src/navigation/AppNavigator.tsx`; screens type props with `NativeStackScreenProps`.

### Remote media (image) policy
- Data URLs come from `@data/*` / feature mocks (enterprise-controlled) — do not rewrite sources in the app.
- Use `expo-image` (Glide/Fresco) with explicit dimensions + local bundled fallback + `onError`; prefer JPEG (`fm=jpg`) so the negotiated format always decodes in Expo Go.

### Security
- Tokens via `expo-secure-store`; never log secrets/PII; prescriptions & payment details never in plain logs; document native permissions in `app.json` and gate with consent.

---

## 2. Future Go Chi backend (`server/`) — planned, not yet built
```
[ mobile app ] --HTTPS/JSON--> [ Go Chi router ]
                                   ↓
                          [ SDUI builder → render tree ]
                                   ↓
                        [ data/ (single source of truth) ]
```
- Goal: serve the structured SDUI tree currently mocked in `data/`, replacing `@mock` sources when each module is wired (`@mock` → `@server`).
- **Do not build server code until requested.** The `server/` folder is a placeholder (see readme).
- When built: every `data/DATA_CONTROL.md` `@mock` entry becomes a contract for a Chi handler; ownership matrix (feature ↔ data file) stays the source of truth.

---

## 3. Cross-cutting principles
- **Lightweight / Fast / Secure** — see `AGENTS.md` core mandate; every change must justify its size.
- **One owner per concern** — reduces duplicate logic and duplicated LLM-generated copies.
- **Traceability** — every data entry is tagged in `data/DATA_CONTROL.md` (`@mock`/`@seed`/`@static`/`@unused`/`@aspirational`) so a consumer can see if data is real, seed, or unused.
- **Boundaries are mechanical** — `npm run check:boundaries` fails CI on cross-module imports; never bypass.
