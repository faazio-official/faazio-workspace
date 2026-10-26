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

## 0. Where migrations live + ordering

- Files: `server/supabase/migrations/*.sql` (zero-padded `NNNN_name.sql`).
- Run strictly in numeric order. SQL outside a transaction (e.g. `create index` / `grant`) is already
  `if not exists`-guarded where needed, but re-applying an already-applied migration is still not
  guaranteed safe — **apply only the pending ones** against production.
- A migration may fail part-way; `ON_ERROR_STOP=1` makes `psql` abort so you can see exactly where.
  Fix forward (a small follow-up migration) rather than editing an applied file.

## 1. Load the credentials

```bash
cd server/gateway
set -a && . ./.env && set +a     # exports DATABASE_URL, SUPABASE_URL, etc. from the git-ignored .env
```

`DATABASE_URL` is the Supabase **Supavisor pooler** connection string (`postgres://postgres.<ref>@…pooler.supabase.com:5432/postgres?sslmode=require`) — IPv4, supports prepared statements.

## 2. Apply a fresh database (all migrations + seed)

```bash
cd server/gateway
set -a && . ./.env && set +a
for f in ../supabase/migrations/*.sql; do
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
done
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ../supabase/seed/0001_seed.sql
```

## 3. Apply only pending migrations (production / existing DB)

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
```

List the files (`ls ../supabase/migrations/ | tail`) and apply everything newer than the last one
that succeeded. Verify a boot: the gateway log on Render should stop emitting
`portal_tables=… hint=apply migration …`, and `GET /health` shows `"db":true`.

## 4. Alternatives to `psql`

- **Supabase SQL Editor** — paste the target migration file's contents into
  Dashboard → SQL Editor and run. Slower for many files; fine for a one-off.
- **Local dev (`server/gateway` docker compose)** — the postgres container auto-applies the files
  mounted in `docker-compose.yml` (`0001`–`0056`, excluding the deleted booking migrations
  `0011`/`0020` and the unused `0035` slot) + seed via `docker-entrypoint-initdb.d` **on first boot
  only**.

## 5. Symptoms of a pending migration

- `*_unavailable` (500) on search/sellers/portal routes while Postgres is healthy.
- Boot log: `portal_tables=missing|partial hint=apply migration NN`.
- Request log: `sqlstate=42703 column=…` (column added by a migration you have not applied).

Fix = run the pending migration with §1–§3, then roll the Render deploy if the gateway needs a restart
(it does not auto-apply anything).