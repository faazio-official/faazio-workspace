# AGENTS.md — Faazio SuperApp

## Core mandate
Build **lightweight, fast, secure**. Every change must justify its size:
- **Lightweight** — small bundle, lean components, no dead code or unused deps.
- **Fast** — efficient rendering, lazy/native where sensible, minimal re-renders.
- **Secure** — never log or commit secrets/PII; tokens via `expo-secure-store`; prescriptions & payments never in plain logs.

## Phase: MVP (now)
**Status: MVP.** The backend is a **thin Go Chi gateway** over **Supabase (Postgres) + MongoDB Atlas M0 + Aiven Valkey**, with Cloudflare in front. This replaces the mocked `@mock` data per module (`@mock` → `@server`).
The full microservices target — Rust/Tantivy search, CockroachDB, DynamoDB, per-service Postgres — is **Future Prod** and stays documented. Single authorities: **`docs/architecture/mvp-backend.md`** (MVP) and **`docs/architecture/monolith-breakdown.md`** (context → package → future-service mapping + extraction playbook).
- MVP = **one Go Chi modular monolith** (`server/gateway`) hosting all 6 bounded contexts (reads + writes), with Supabase migrations + seed under `server/supabase/`. Extract Rust/Go services later per `monolith-breakdown.md` — no rewrite.
- Cache keys/TTLs are **unchanged** (Aiven Valkey + Cloudflare); Supabase is the origin, not the cache.

## Repo map
```
faazio-workspace/
├── (root)          Repo root — docs + project docs only (AGENTS.md, ARCHITECTURE.md, LICENSE, PAGE_CATALOG.md, PENDING_WORK.md, README.md).
├── client/mobile/  React Native (Expo) SuperApp — ALL active work lives here.
├── client/web/     Partner Portal — Next.js App Router console (`portal/`, shipping) + the Vite/TanStack reference (`vite-reference/`, read-only diff baseline) + the marketing landing page (`landingpage/`, TanStack Start + Nitro, deployed on Vercel — see its README.md). See docs/architecture/web-portal.md.
├── server/         MVP Go Chi modular monolith `gateway/` + Supabase migrations/seed (active) + future full microservices (see docs/architecture/mvp-backend.md, monolith-breakdown.md).
├── data/           SDUI source of truth (enterprise-controlled), consumed via @data/*.
├── docs/           Documentation system — architecture deep-dives + runbooks (see "Documentation map").
└── security/       Security hardening scripts + remediation guide (see "Security").
```
See `ARCHITECTURE.md` (root) for the full mobile + backend design. Data ownership lives in `data/DATA_CONTROL.md`.

## Documentation map
Structured docs live under root `docs/` (mirrors the repo layout):

```
docs/
├── README.md                       # index + reading order
├── DEVELOPER_ONBOARDING.md         # numbered getting-started guide
├── BRAND_COLOR_MIGRATION.md        # royal-purple → Faazio-blue change log + revert
├── architecture/                   # deep-dives (mvp-backend, monolith-breakdown, mobile-app, web-portal, data-layer-sdui, server-gateway-plan, db-schema, caching-cloudflare-valkey)
└── RUNBOOKS/                       # operational guides (RELEASE, CI_PIPELINE, DATA_FIXTURES, TROUBLESHOOTING)
```

Reading order for a new contributor: `AGENTS.md` → `ARCHITECTURE.md` →
`docs/DEVELOPER_ONBOARDING.md` → `data/DATA_CONTROL.md` → `docs/README.md`.
`client/mobile/` also has `docs/` (appstore/playstore/release) and `PENDING_WORK.md` (backlog).

## Hard rules
1. **Wait for user intent.** Do NOT build screens/pages until explicitly requested. **Exception:** the MVP thin gateway + Supabase migrations (`docs/architecture/mvp-backend.md`) are the sanctioned server scope — build them when the user asks for the MVP backend.
2. **Imports** — `@/` → `client/mobile/src/`, `@data/` → root `data/`.
3. **State** — shared state ONLY in Zustand stores under `src/state/`. Keep components presentational; read via selectors. No duplicate shared state.
4. **Modularity** — small components under `src/components/`; screen helpers under their `src/features/<module>/`; shared widgets under `src/components/shared/`. Reuse before duplicating (avoid parallel mock copies).
5. **Navigation** — all routes typed in `src/navigation/AppNavigator.tsx`; screens use `NativeStackScreenProps`.
6. **Native permissions** — document in `app.json` (`ios.infoPlist`/`android.permissions`) and gate with consent dialogs before hardware.
7. **Brand** — always use the Faazio logo (`<FaazioLogo />`), never raw text placeholders.
8. **Layout** — full-viewport, non-scrollable (`h-[100dvh]`), no faux device borders/notches.
9. **Boundaries** — cross-sub-app access only via Home. Enforced by `check:boundaries`.
10. **Docs** — architecture deep-dives live in `docs/architecture/`, operational guides in `docs/RUNBOOKS/`; update `docs/README.md` and the "Documentation map" when adding docs.
11. **Refactor-doc freshness** — any new server function/handler/package, DB table/column/index, cache key/TTL, endpoint, or `GatewayClient` method MUST update `docs/architecture/monolith-breakdown.md` (ownership table + extraction checklist) in the same change. PRs that add server code without the doc touch fail review. If no doc change is needed, state why in the PR.

## Update docs by default
Any code change that affects behavior, structure, or APIs must update the docs **by default** in
the same change — do not wait to be asked. Concretely, after implementing:
- **New/removed/renamed feature, module, screen, route, or store** → update
  `docs/architecture/mobile-app.md` (module map, stores table, nav graph) and `client/mobile/PENDING_WORK.md`.
- **Data/`@data/*` changes** → update `data/DATA_CONTROL.md` and `docs/architecture/data-layer-sdui.md`.
- **Server/API changes** → update `docs/architecture/server-gateway-plan.md` and, for package/context
  or endpoint changes, `docs/architecture/monolith-breakdown.md` (§1 ownership table).
- **DB / schema / migration changes** → update `docs/architecture/db-schema.md` (and
  `monolith-breakdown.md` §1 when a context's schema set changes).
- **Cache key / TTL / purge changes** → update `docs/architecture/caching-cloudflare-valkey.md`.
- **Build/deploy/signing changes** → update `docs/RUNBOOKS/RELEASE.md`.
- **Build/run/verification changes** → update `docs/RUNBOOKS/TROUBLESHOOTING.md` and the relevant section of `docs/DEVELOPER_ONBOARDING.md`.
- **Behavior removed** (e.g. deleted UI like an exit-confirm sheet) → remove the now-stale
  description from the deep-dive/runbook that mentioned it.

Keep edits concise and factual (no invented details). If a doc already describes the new state,
no change is needed — but always check before finishing.

## Verify after any change
Run from `client/mobile/`:
```bash
npm run ts:check          # typecheck (always)
npm run check:boundaries  # dependency-cruiser
```

## Builds are CI-only — never run Gradle locally
**Never run `npm run android` / `expo run:android` / `./gradlew` on this machine.** Local Gradle
builds get SIGKILLed by `systemd-oomd` at the 50% memory-pressure threshold (see
`docs/RUNBOOKS/TROUBLESHOOTING.md` → "Gradle / native build failures") and waste the user's RAM.
Instead let GitHub Actions build and surface any build errors:

```bash
gh workflow run android-debug.yml          # debug APK artifact (device testing)
gh workflow run "Release APK"              # signed release APK -> GitHub Release
gh run watch                               # wait for the run to finish
gh run view --log-failed                   # <-- pull build errors from CI
```

The CI Gradle build command (do not reproduce locally; it lives in the workflow):
```bash
cd android
./gradlew assembleDebug --no-daemon -PreactNativeArchitectures="arm64-v8a"
# release: ./gradlew assembleRelease --no-daemon \
#   -PreactNativeArchitectures="arm64-v8a,armeabi-v7a" \
#   -Pandroid.enableMinifyInReleaseBuilds=true \
#   -Pandroid.enableShrinkResourcesInReleaseBuilds=true
```

Install a CI artifact on the device (never build it locally):
```bash
gh run download <run-id> -n faazio-debug-apk
adb install -r app-debug.apk
adb reverse tcp:8081 tcp:8081        # then `npx expo start` locally for Metro
```

Full details: `docs/RUNBOOKS/CI_PIPELINE.md`. Local `npm run start` (Metro) is fine — it is the
bundler, **not** Gradle.

## Modules
Shipped (`client/mobile/src/features/`): `onboarding`, `auth`, `home`, `ecommerce`
(mart — incl. former grocery catalog), `food`, `cart`, `profile`, `pharma`, `catalog`, `search`, `product`,
`favourites`, `sub-app`. `dinner-booking` is a scaffold (README only).

Remaining/backlog work is tracked in `client/mobile/PENDING_WORK.md` (e.g. wiring
`GatewayClient`, server-backed flows, de-duplicating inline mock data). `GatewayClient` wiring is
**unblocked by the MVP thin gateway** (`docs/architecture/mvp-backend.md`); build new screens
only when explicitly requested.

## Security — Phase 1: Security steps for future projects

### 1. During development (the code)
- **Never hardcode secrets** — no DB passwords, API keys, or SSH keys in code. Use environment variables (`.env` files).
- **Sanitize inputs** — always use parameterized queries for databases (prevents SQL injection); validate and sanitize all user forms.
- **Keep dependencies updated** — run automated tools like `npm audit` or `pip audit` before deploying to catch known CVEs in third-party packages.

### 2. During deployment (the infrastructure)
- **Lock down ports** — close every port except what's necessary. Keep DB ports (e.g. `3306` MySQL, `6379` Redis) closed to the public internet entirely.
- **Use SSH keys, not passwords** — disable password login for SSH, use cryptographic SSH keys, and change the default SSH port (22) to a custom number.
- **Hide behind Cloudflare (correctly)** — the backend server firewall must only accept traffic from Cloudflare's official IP ranges. Leaving it open lets attackers bypass Cloudflare and hit the server directly.
- **Block system files** — block public web access to sensitive dirs like `.git/` or `.DS_Store` in the web-server config (Nginx/Apache).

## Security — Phase 2: Prompting an LLM for secure coding
When using LLMs to write code or deploy scripts, never just ask for "working code" (that prioritizes simplicity over security). Explicitly prompt the AI to include security layers.

### Prompt template 1 — writing code securely
> "I am building a [insert language/framework, e.g., Node.js Express] application for a school dashboard. Write the code for a user login and data retrieval system. Ensure the code follows strict security best practices, including input sanitization, protection against SQL Injection, secure password hashing using bcrypt, and robust error handling that does not leak system paths."

### Prompt template 2 — deploying a server securely
> "I am deploying a production web application on an Ubuntu server using [Nginx / Docker / Apache]. Provide a step-by-step checklist and commands to harden this server. Specifically, show me how to block access to hidden folders (like .git), how to configure the firewall (UFW) to block database ports from the public, and how to securely handle environment variables so secrets aren't exposed."

### Prompt template 3 — reviewing existing code
> "Act as a Senior Cyber Security Auditor. Review the following code snippet for potential vulnerabilities (OWASP Top 10). Identify any risks regarding data exposure, broken authentication, or injection flaws, and provide the secure, corrected version of the code: [Insert Code Here]"
