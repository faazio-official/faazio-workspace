# Architecture.md — Faazio SuperApp

> **Concern:** high-level technical architecture for the two real runtimes — the **bare React Native mobile app** (`client/mobile/`) and the **Go Chi backend** (`server/`, production modular monolith + documented scaling microservices). Modular, layered, and trackable so every concern has one owner and nothing is silently re-invented (or duplicated) because it "was modular."

## Runtime boundaries (what is live vs frozen vs planned)
| Surface | Stack | Status |
|---|---|---|
| `client/mobile/` | Bare React Native 0.86.3 + TypeScript + Zustand | **LIVE.** All active work. |
| `data/` | Typed entity arrays (SDUI source of truth) | **LIVE (enterprise-controlled).** Read-only for the app; consumed via `@data/*`. |
| `server/` | Go Chi backend — production modular monolith over Supabase + MongoDB + Valkey | **Production (live, built).** Scaling stage = full microservices (documented; extract per `monolith-breakdown.md`). See `docs/architecture/mvp-backend.md`, `monolith-breakdown.md`. |
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
`@data/*` (root data/)  ·  bare `react-native` APIs
```
- A module may only import **down** the stack, never sideways into another module's internals.
- Cross-module data access is **Home-only**, enforced by `dependency-cruiser` (`npm run check:boundaries`).

### Module map (`src/features/`)
| Feature | Domain | Local helper folder |
|---|---|---|
| onboarding / auth | first-run flow, login, OTP | `features/auth` |
| home | aggregated feed; sanctioned cross-module consumer | `features/home/sections/*` |
| ecommerce | mart rails + catalog (incl. former grocery) | `features/ecommerce/*-home/` |
| food | restaurant/dish browsing | `features/food/` |
| seller-partner | seller login + order accept/reject | `features/seller-partner/` |
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
- Use the shared `components/shared/AppImage` (React Native `Image`, Fresco/NSURLCache) with explicit dimensions + local bundled fallback + `onError`; prefer JPEG (`fm=jpg`) so the negotiated format always decodes.

### Security
- Tokens via `react-native-keychain` (Android Keystore / iOS Keychain); never log secrets/PII; prescriptions & payment details never in plain logs; document native permissions in `android/app/src/main/AndroidManifest.xml` + `ios/Faazio/Info.plist` and gate with consent.

---

## 2. Go Chi backend (`server/`)

### 2a. Production — modular monolith (live, built)
```
[ mobile app ] --HTTPS/JSON--> [ Go Chi modular monolith  server/gateway ]
   GatewayClient                  6 contexts in one binary (contracts interfaces)
                                   │
                    Supabase (Postgres) + MongoDB Atlas M0 + Aiven Valkey
                                   ▲
                          Cloudflare (edge)
```
- Production = **one Go Chi modular monolith** (`server/gateway`) hosting all 6 bounded contexts as
  packages behind `internal/contracts` interfaces, serving live data per module (`@mock` → `@server`).
  Cache keys/TTLs unchanged (Supabase is the origin, not the cache).
- Authority: `docs/architecture/mvp-backend.md` (decision matrix, schemas, endpoints) +
  `docs/architecture/monolith-breakdown.md` (context → package → scaling-service mapping).
- `GatewayClient` (`client/mobile/src/services/api/GatewayClient.ts`) is **wired** (baseUrl + flag)
  and **server-only** (no `@data/*` substitution on failure) — see
  `docs/architecture/data-layer-sdui.md`.
- Every `data/DATA_CONTROL.md` `@mock` entry is now a contract for a gateway handler.

### 2b. Scaling stage — full microservices (documented target, not yet built)
```
[ mobile app ] --HTTPS/JSON--> [ Go Chi router ]
                                   ↓
                          [ SDUI builder → render tree ]
                                   ↓
                        [ data/ (single source of truth) ]
```
- Goal: serve the structured SDUI tree currently mocked in `data/`, replacing `@mock` sources when each module is wired (`@mock` → `@server`).
- **Extract services only when a scale trigger hits** (packaging change, not rewrite) per
  `monolith-breakdown.md`; the production monolith is §2a. Do not build full-microservice server code
  until a trigger is hit and the work is requested.
- **Gateway client:** `client/mobile/src/services/api/GatewayClient.ts` is the single data surface.
  It joins the normalized microservice-shaped tables under `data/` (see `data/DATA_CONTROL.md` →
  "Normalized Microservice Tables") and is wired to the production monolith, server-only; screens read
  it directly (`@mock` → `@server` migration complete).
- When built: every `data/DATA_CONTROL.md` `@mock` entry becomes a contract for a Chi handler; ownership matrix (feature ↔ data file) stays the source of truth.
- **DB schemas** for the microservices are specified in `docs/architecture/db-schema.md`; the cache
  layer (Cloudflare edge + Aiven Valkey) is specified in `docs/architecture/caching-cloudflare-valkey.md`.

---

## 3. Cross-cutting principles
- **Lightweight / Fast / Secure** — see `AGENTS.md` core mandate; every change must justify its size.
- **One owner per concern** — reduces duplicate logic and duplicated LLM-generated copies.
- **Traceability** — every data entry is tagged in `data/DATA_CONTROL.md` (`@mock`/`@seed`/`@static`/`@unused`/`@aspirational`) so a consumer can see if data is real, seed, or unused.
- **Boundaries are mechanical** — `npm run check:boundaries` fails CI on cross-module imports; never bypass.
