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
gh workflow run android-debug.yml             # debug APK built on GitHub's runners
gh run watch
gh run download <run-id> -n faazio-debug-apk  # -> app-debug.apk
adb install -r app-debug.apk
adb reverse tcp:8081 tcp:8081                 # then: npm run start   (Metro, local)
```

- Metro (`npm run start`) runs **locally** — it is the JS bundler, not Gradle. JS-only changes
  hot-reload; native changes require a new CI APK.
- The debug APK connects to Metro over `adb reverse` (no rebuild needed for JS changes).
- Full-screen, non-scrollable layout per AGENTS.md rule 8.

### Speed tip: single-ABI debug builds

The CI debug workflow defaults to `arm64-v8a`; pass `-f archs=arm64-v8a,armeabi-v7a` if you need
more. Release CI builds use `arm64-v8a,armeabi-v7a` (see `docs/RUNBOOKS/RELEASE.md`).

## 4. Verify every change

```bash
npm run ts:check          # TypeScript typecheck
npm run check:boundaries  # dependency-cruiser — enforces cross-module import rules
npm run check:drillin     # category taxonomy ↔ mart/pharma catalog coverage guard
```

All three must pass before pushing. `check:boundaries` fails on any sub-app importing another
sub-app's internals (only `Home` is allowed to cross sub-apps). `check:drillin` fails if any
`MASTER_CATEGORIES` title resolves no vendor (the category drill-in would render empty).

### 4a. Run & verify the backend (Go modular monolith)

The MVP backend is one Go Chi binary at `server/gateway`. Run it with the local stack
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
point the app at it, copy `.env.example` → `.env.local` and set `GATEWAY_URL=http://<host>:8080`
and `USE_GATEWAY=true`; `scripts/configure.js` generates `src/lib/config.ts` before Metro starts and
`GatewayClient` falls back to `@data/*` on any error. Add `STRICT=true` to disable the fallback for
money/Rx/address writes (a failed write then fails loudly instead of faking a local success).
Optionally set `DEV_USER=user-1` to send the dev-only `X-Dev-User` header explicitly (dev builds
only; never attached in a release APK, and ignored by an `AUTH_DISABLED=false` gateway). For real
phone-OTP sign-in against an `AUTH_DISABLED=false` gateway, set `SUPABASE_URL` +
`SUPABASE_ANON_KEY` (release builds require them). Regenerate
the DB seed after editing `@data/*`:
`node server/supabase/seed/generate.mjs`. Details: `server/gateway/README.md`.

### 4b. Ship a release APK

Release builds run in **GitHub Actions**, not on your machine (see `docs/RUNBOOKS/RELEASE.md`):

```bash
cd client/mobile
gh workflow run release-apk.yml -f version=1.0.2 -f tag=v1.0.2
gh run watch                 # wait; signed APK lands on the GitHub Release
```

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
