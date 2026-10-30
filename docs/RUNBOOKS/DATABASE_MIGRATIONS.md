# Database migrations (Supabase)

**Policy: Render never applies migrations.** The gateway container on Render is a **distroless** image
that bundles only the static Go binary (`/server`) — no SQL files, no `psql`, no shell (see
`server/gateway/Dockerfile`). The binary never runs a migration: at boot it only health-checks the
Postgres origin and logs which tables/migrations look missing (e.g. `portal_tables=missing
hint=apply migrations 0032 + 0033`). If a migration is pending, the affected routes return
`*_unavailable` / `portal_unavailable` until someone applies it.

**Therefore every migration is applied manually from a developer terminal**, using the credentials in
`server/gateway/.env` (git-ignored — the pooler `DATABASE_URL` is the same project the gateway on
Render talks to). Recommended order on a release: **apply migrations → deploy/roll the gateway**, so
the new code never runs against an un-migrated schema.

> **"Run the migration" in chat means run `server/supabase/apply-migration.sh`** from a dev terminal.
> It reads `DATABASE_URL` from `server/gateway/.env` and applies the SQL through the Go migrator
> `server/gateway/cmd/migrate` (pgx — **no `psql`, no Docker**). It aborts on the first error and
> never prints the connection string. Treat it as an actionable request.

## 0. Where migrations live + ordering

- Files: `server/supabase/migrations/*.sql` (zero-padded `NNNN_name.sql`).
- Run strictly in numeric order. SQL outside a transaction (e.g. `create index` / `grant`) is already
  `if not exists`-guarded where needed, but re-applying an already-applied migration is still not
  guaranteed safe — **apply only the pending ones** against production.
- The Go migrator splits each file into statements and applies them one at a time over the simple
  query protocol (autocommit) — matching `psql` — so `CREATE INDEX CONCURRENTLY` (used in `0004` /
  `0038`) still works. Files that carry their own `BEGIN`/`COMMIT` (the seed) batch as intended.
- A migration may fail part-way; the migrator stops on the first failing statement and prints it.
  Fix forward (a small follow-up migration) rather than editing an applied file.

## 1. Apply with the Go migrator (preferred)

`server/supabase/apply-migration.sh` reads `DATABASE_URL` from the git-ignored
`server/gateway/.env` and runs `server/gateway/cmd/migrate` (pgx; no `psql`/Docker) — run it from the
**repo root**:

```bash
# one or more specific files, applied in the order given:
server/supabase/apply-migration.sh server/supabase/migrations/0061_blood_request_author.sql

# every migration numbered >= the given prefix (i.e. the pending ones):
server/supabase/apply-migration.sh --from 0061

# fresh database: every migration, then the seed:
server/supabase/apply-migration.sh --all --seed
```

`--from NNNN` compares the zero-padded numeric prefix, so `--from 0061` applies `0061…` onward.
`--seed` appends `server/supabase/seed/0001_seed.sql`.

List the files (`ls server/supabase/migrations/ | tail`) and apply everything newer than the last one
that succeeded. Verify a boot: the gateway log on Render should stop emitting
`portal_tables=... hint=apply migration ...`, and `GET /health` shows `"db":true`.

## 2. Manual `psql` (alternative)

Use this only when `psql` is already installed and you prefer the raw commands.

```bash
cd server/gateway
set -a && . ./.env && set +a     # exports DATABASE_URL, SUPABASE_URL, etc. from the git-ignored .env
```

`DATABASE_URL` is the Supabase **Supavisor pooler** connection string (`postgres://postgres.<ref>@...pooler.supabase.com:5432/postgres?sslmode=require`) — IPv4, supports prepared statements.

### Fresh database (all migrations + seed)

```bash
cd server/gateway
set -a && . ./.env && set +a
for f in ../supabase/migrations/*.sql; do
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
done
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ../supabase/seed/0001_seed.sql
```

### Only pending migrations (production / existing DB)

```bash
cd server/gateway
set -a && . ./.env && set +a
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ../supabase/migrations/0046_district_master.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ../supabase/migrations/0047_seller_district.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ../supabase/migrations/0048_district_admins.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ../supabase/migrations/0049_seller_fee_change_requests.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ../supabase/migrations/0050_district_rls.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ../supabase/migrations/0051_tax_invoices.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ../supabase/migrations/0052_delivery_payout.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ../supabase/migrations/0053_delivery_fee_settings.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ../supabase/migrations/0054_weather_festival.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ../supabase/migrations/0055_delivery_manual_payout.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ../supabase/migrations/0056_seller_order_decisions.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ../supabase/migrations/0057_strict_district_owner_backfill.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ../supabase/migrations/0058_notifications_retry.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ../supabase/migrations/0059_app_config.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ../supabase/migrations/0060_account_deletion.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ../supabase/migrations/0061_blood_request_author.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ../supabase/migrations/0062_error_events.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ../supabase/migrations/0063_seller_tiruchirappalli.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ../supabase/migrations/0064_seller_tiruchi_contact.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ../supabase/migrations/0065_tiruchirappalli_district_admin.sql
```

> The list above is illustrative. Prefer §1 (`apply-migration.sh --from <last-applied>`), which
> always targets the real pending files — the committed set grows every change.

## 3. Other alternatives

- **Supabase SQL Editor** — paste the target migration file's contents into
  Dashboard → SQL Editor and run. Slower for many files; fine for a one-off.
- **Local dev (`server/gateway` docker compose)** — the postgres container auto-applies the files
  mounted in `docker-compose.yml` (`0001`–`0065`, excluding the deleted booking migrations
  `0011`/`0020` and the unused `0035` slot) + seed via `docker-entrypoint-initdb.d` **on first boot
  only**. Re-run `docker compose down -v` to re-seed a changed migration set.

## 4. Symptoms of a pending migration

- `*_unavailable` (500) on search/sellers/portal routes while Postgres is healthy.
- Boot log: `portal_tables=missing|partial hint=apply migration NN`.
- Request log: `sqlstate=42703 column=...` (column added by a migration you have not applied).

Fix = run the pending migration with §1 (or §2), then roll the Render deploy if the gateway needs a
restart (it does not auto-apply anything).

## 5. Read-only diagnostics

SELECT-only checks live in `server/supabase/diagnostics/*.sql` — **never** under `migrations/`. The
Go migrator discards query result rows (`server/gateway/cmd/migrate/main.go` runs
`PgConn().Exec().ReadAll()` and ignores the rows), so a diagnostic piped through
`apply-migration.sh` prints nothing. Run one in the Supabase SQL Editor (or any pgx/psql client);
`diagnostics/verify-seller-tiruchi.sql` confirms the `0063` seller, the `0065` TTC roster row and the
district-admin login's `district_code` scope.
