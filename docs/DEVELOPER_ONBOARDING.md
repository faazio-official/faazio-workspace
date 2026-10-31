# Developer Onboarding

Get the Faazio mobile app building and running on a device, end to end.

## 1. System Requirements

- **Node.js** 20+ (LTS recommended) with `npm`
- **JDK** 17+ (RN 0.86 / AGP 8.12 builds need a recent JDK; 21 works)
- **Android SDK** + `platform-tools` (`adb`) with `ANDROID_HOME` set
- **Git**

> iOS: only on macOS with Xcode + the iOS simulators. This guide focuses on Android
> (the active target), but the steps mirror for iOS via `npm run ios`.

## 2. Initial Setup

```bash
git clone <repo-url> faazio-workspace
cd faazio-workspace/client/mobile
npm install
```

`npm install` runs `postinstall` → `patch-package` + `node scripts/configure.js`, which **must**
succeed (it applies the `react-native-reanimated` patch and generates `src/lib/config.ts`). If you
change deps, re-run `npm install` so patches re-apply.

## 3. Run on a device / emulator

> **Builds are CI-only on this project.** Do **not** run `npm run android` / `react-native
> run-android` / `./gradlew` — the host's `systemd-oomd` SIGKILLs Gradle under memory pressure (see
> `docs/RUNBOOKS/TROUBLESHOOTING.md` → "Gradle / native build failures"). Let GitHub Actions build
> the APK, then install the artifact:

```bash
adb devices                                   # confirm a device shows up
gh workflow run android-debug.yml -f app=customer   # or -f app=delivery
gh run watch
gh run download <run-id> -n faazio-customer-debug-apk  # -> app-customer-debug.apk
adb install -r app-customer-debug.apk
adb reverse tcp:8081 tcp:8081                 # then: npm run start   (Metro, local)
```

- Metro (`npm run start`) runs **locally** — it is the JS bundler, not Gradle. JS-only changes
  hot-reload; native changes require a new CI APK.
- The debug APK connects to Metro over `adb reverse` (no rebuild needed for JS changes).
- Full-screen, non-scrollable layout per AGENTS.md rule 8.

### Speed tip: single-ABI debug builds

The CI debug workflow defaults to `arm64-v8a`; pass `-f archs=arm64-v8a,armeabi-v7a` if you need
more. Release CI builds are **arm64-only** (`arm64-v8a`); pass `-f include-aab=true` to also
produce the Play-bound AAB (see `docs/RUNBOOKS/RELEASE.md`).

## 4. Verify every change

```bash
npm run ts:check          # TypeScript typecheck
npm run check:boundaries  # dependency-cruiser — enforces cross-module import rules
npm run check:drillin     # category taxonomy ↔ mart/pharma catalog coverage guard
```

All three must pass before pushing. `check:boundaries` fails on any sub-app importing another
sub-app's internals (only `Home` is allowed to cross sub-apps). `check:drillin` fails if any
taxonomy title (from `server/supabase/seed/lib/taxonomy.mjs`) resolves no vendor (the category
drill-in would render empty).

### 4b. Central remote config (the "Central Digital Menu")

App settings that used to need a store release are now SUPER_ADMIN-edited in
`admin/super/app-config` and served to every app on cold boot (`GET /app-config`, `admins.app_config`
`0059`, `remoteConfigStore`). A fetch failure is silent — the app falls back to the bake-time
`scripts/configure.js` values, so build-time keys (`GATEWAY_URL`, native Maps keys, `CERT_PINS`)
stay unchanged. `GOOGLE_PLACES_API_KEY` is the first runtime-managed key (`maps.places_api_key`;
empty keeps the baked value).

### 4a. Run & verify the backend (Go modular monolith)

The production backend is one Go Chi binary at `server/gateway`. Run it with the local stack
(Postgres + Valkey + Mongo, migrations + seed applied automatically):

```bash
cd server/gateway
docker compose up --build          # then: curl localhost:8080/health
go build ./... && go vet ./... && go test ./...
go run ./tools/importlint          # fails on sibling-context imports
```

`docker compose up` boots Postgres + Valkey + Mongo, applies the migrations + seed automatically,
runs `mongosh` on `server/supabase/seed/mongo/seed.js` (upserts the ID-only Home layout + TTL index),
and starts the gateway. `curl localhost:8080/health` should report `db:true cache:true mongo:true`.

> **Migrations only run on a *fresh* volume.** `docker-entrypoint-initdb.d` executes once, when the
> Postgres data directory is created. After pulling new migrations (`0021+`) or editing `@data/*`
> (then `node server/supabase/seed/generate.mjs`), reset and re-seed with
> `docker compose down -v && docker compose up -d`. A stale volume makes integration tests fail
> with `column … does not exist` even though `/health` looks green.
>
> Production (Supabase) is the opposite: **Render never applies migrations** — they are run by hand
> from a dev terminal with `server/supabase/apply-migration.sh` (reads `DATABASE_URL` from
> `server/gateway/.env`; `docs/RUNBOOKS/DATABASE_MIGRATIONS.md`). Local compose auto-applies every
> committed migration (`0001`–`0056`) + seed on a fresh volume.

Integration tests (FTS, order lock/decrement, rating gate, PII redaction, pagination) **skip**
unless pointed at the stack; run them fully with:

```bash
TEST_DATABASE_URL='postgres://postgres:faazio@localhost:5432/faazio?sslmode=disable' \
TEST_VALKEY_URL='redis://localhost:6379/0' \
go test ./...
```

> Managed Atlas M0 does **not** auto-run `seed.js` (only the local `mongo` image does). Seed Atlas
> manually: `mongosh "$MONGO_URI/faazio" --file server/supabase/seed/mongo/seed.js`.

Local dev is auth-open (`AUTH_DISABLED=true`, user `user-1`; the gateway logs a loud warning). To
point the app at it, set `GATEWAY_URL=http://<host>:8080` in the Android app's env file
(`client/mobile/.env.android.customer`, or `.delivery` / `.seller` for those apps; `.env.ios` for iOS
— each file is standalone; a gitignored `.env.local` overrides locally).
For the seller product (a WebView over the Partner Portal) also set `WEB_PORTAL_URL` — the portal
origin the shell loads at `/login` (e.g. `WEB_PORTAL_URL=https://app.faazio.com`, or
`http://localhost:3000` for a local portal). A seller build **fails `configure.js`** if it is empty
(dev and release), so set it in `client/mobile/.env.android.seller` / `.env.ios` before `npm run start:seller`. Release
seller builds refuse `http://` and require the `GOOGLE_SERVICES_SELLER_JSON` CI secret. For nearby
ordering + the seller shop-pin map, also set
`GOOGLE_MAPS_API_KEY_ANDROID` (the `.env.android.*` files) and
`GOOGLE_PLACES_API_KEY` (in every env file; restricted keys; empty is a supported degraded mode). Run
`npm run configure` after changing them; set `USE_GATEWAY=true` so `scripts/configure.js` generates
`src/lib/config.ts` before Metro starts. `GatewayClient` is **server-only**: a failed or disabled
remote read/write throws (`GatewayHttpError` / `GatewayOfflineError`) instead of substituting
`@data/*` — screens that want an offline first paint own that fallback explicitly. `STRICT` is
retained for build compatibility and no longer changes behavior (all remote calls are strict).
Optionally set `DEV_USER=user-1` to send the dev-only `X-Dev-User` header explicitly (dev builds
only; never attached in a release APK, and ignored by an `AUTH_DISABLED=false` gateway). Real
phone-OTP sign-in uses the native Firebase SDK: the public client config is committed in
`android/app/google-services.json` and `ios/Faazio/GoogleService-Info.plist`, and release builds
require both. Set `USE_FIREBASE_AUTH=false` only for a local mock-login run. Setup and the
outstanding anti-abuse step (Play Integrity/APNs) are in
[RUNBOOKS/FIREBASE_AUTH.md](./RUNBOOKS/FIREBASE_AUTH.md). Regenerate
the DB seed after editing `@data/*`:
`node server/supabase/seed/generate.mjs`. Details: `server/gateway/README.md`.

### 4b. Ship a release APK

Release builds run in **GitHub Actions**, not on your machine (see `docs/RUNBOOKS/RELEASE.md`):

```bash
cd client/mobile
gh workflow run release-apk.yml -f app=customer -f version=1.0.2 -f tag=v1.0.2
gh run watch                 # wait; signed APK lands on the GitHub Release
```

### 4c. Run & verify the Partner Portal (Next.js)

The portal at `client/web/platform` is portal-auth only: it calls the gateway server-side from its
route handlers. Copy `.env.example` → `.env.local` and set
`NEXT_PUBLIC_GATEWAY_URL=http://localhost:8080` (the committed template must never carry a real
origin). `NEXT_PUBLIC_*` is inlined at build time, so a change needs a rebuild.

```bash
cd client/web/platform
npm run dev        # predev runs scripts/check-env.mjs and warns on missing/invalid env
npm run ts:check && npm run lint
npm run build      # prebuild fails the build if NEXT_PUBLIC_GATEWAY_URL is unset
```

If sign-in returns `503`, call `GET /api/auth/portal/status` (or follow
`docs/RUNBOOKS/PORTAL_AUTH.md` §0) to tell a missing portal env (A), an unreachable gateway (B), a
missing Render `PORTAL_JWT_SECRET` (C) or an unapplied migration (D) apart.

## 5. Project orientation

| Resource | What it is |
|---|---|
| `ARCHITECTURE.md` (root) | High-level mobile + future-Chi design |
| `docs/` (root) | This guide + architecture deep-dives + runbooks |
| `data/DATA_CONTROL.md` | Data ownership & `@mock`/`@seed`/`@static` status matrix |
| `PAGE_CATALOG.md` (root) | Every screen/path, with navigation routes |
| `PENDING_WORK.md` (`client/mobile/`) | Deferred / backlog work ledger |

Key paths: `@/` → `client/mobile/src/`, `@data/` → root `data/`.

## 6. Next steps

1. Read [architecture/mobile-app.md](./architecture/mobile-app.md) for module/state/nav layout.
2. Read [architecture/data-layer-sdui.md](./architecture/data-layer-sdui.md) before touching `data/`.
3. Follow [RUNBOOKS/DATA_FIXTURES.md](./RUNBOOKS/DATA_FIXTURES.md) when adding mock data.
4. If a build breaks, see [RUNBOOKS/TROUBLESHOOTING.md](./RUNBOOKS/TROUBLESHOOTING.md).

Welcome aboard! 🚀
