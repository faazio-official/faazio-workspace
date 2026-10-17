# Faazio Docs

Operational and architectural documentation for the **Faazio SuperApp**.

## Reading order (for a new contributor)

1. `AGENTS.md` (root) — core mandate, hard rules, verify commands.
2. `ARCHITECTURE.md` (root) — high-level mobile + future-backend design.
3. **`DEVELOPER_ONBOARDING.md`** — get a device booting in ~15 minutes.
4. `data/DATA_CONTROL.md` — data ownership & status matrix (authoritative).
5. `PAGE_CATALOG.md` (root) — every screen/path in the app.
6. `PENDING_WORK.md` (root) — repo-level backlog (server/DB/web/data); app-only backlog lives in `client/mobile/PENDING_WORK.md`.

## Map

| Doc | Purpose | Audience |
|---|---|---|
| [DEVELOPER_ONBOARDING.md](./DEVELOPER_ONBOARDING.md) | Numbered getting-started guide (setup → run → verify) | Everyone |
| [BRAND_COLOR_MIGRATION.md](./BRAND_COLOR_MIGRATION.md) | Royal-purple → Faazio-blue change log + revert command | Design / maintainers |
| [architecture/mvp-backend.md](./architecture/mvp-backend.md) | **MVP authority**: Go Chi modular monolith over Supabase + MongoDB + Valkey (contexts, endpoints, RLS) | Engineers / infra |
| [architecture/monolith-breakdown.md](./architecture/monolith-breakdown.md) | **Refactor authority**: context → package → schema → future-service ownership, boundaries, extraction playbook | Engineers / infra |
| [architecture/mobile-app.md](./architecture/mobile-app.md) | Deep dive: RN app internals (modules, state, nav, boundaries) | Engineers |
| [architecture/web-portal.md](./architecture/web-portal.md) | Deep dive: Next.js Partner Portal (routing split, migration decisions, data seam) | Engineers |
| [architecture/data-layer-sdui.md](./architecture/data-layer-sdui.md) | Deep dive: `data/` layer + SDUI path + GatewayClient | Engineers |
| [architecture/server-gateway-plan.md](./architecture/server-gateway-plan.md) | Deep dive: future Go Chi microservices plan | Engineers / infra |
| [architecture/db-schema.md](./architecture/db-schema.md) | Deep dive: future microservice DB schemas (tables, datatypes, sample rows) | Engineers / infra |
| [architecture/caching-cloudflare-valkey.md](./architecture/caching-cloudflare-valkey.md) | Deep dive: Cloudflare edge + Aiven Valkey cache layer | Engineers / infra |
| [RUNBOOKS/RELEASE.md](./RUNBOOKS/RELEASE.md) | Build, sign, and ship Android + iOS | Release / DevOps |
| [RUNBOOKS/CI_PIPELINE.md](./RUNBOOKS/CI_PIPELINE.md) | GitHub Actions build + release flow (gh CLI, secrets, dev-vs-CI) | Release / DevOps |
| [RUNBOOKS/DATA_FIXTURES.md](./RUNBOOKS/DATA_FIXTURES.md) | Authoring rules for `@data/*` fixtures | Engineers |
| [RUNBOOKS/TROUBLESHOOTING.md](./RUNBOOKS/TROUBLESHOOTING.md) | adb / Metro / Gradle / boundary failure fixes | Engineers |

## Conventions

- **Architecture deep-dives** live under `docs/architecture/`.
- **Operational guides / runbooks** live under `docs/RUNBOOKS/`.
- When you add a doc, add it to this index and to the `docs/` tree in root `AGENTS.md`.
