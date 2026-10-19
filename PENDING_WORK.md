# Pending Work — Repo Backlog

Cross-cutting, repo-level backlog (server · DB · web · data). Client-app-only work lives in
`client/mobile/PENDING_WORK.md`; this file tracks the pieces that span surfaces or need ops.

Status legend: 🟢 shipped · 🔵 in progress · 🟡 open (needs a decision) · 🔴 blocked (needs ops/secrets).

Authority docs: `docs/architecture/mvp-backend.md` (MVP), `monolith-breakdown.md` (ownership),
`docs/RUNBOOKS/DATA_FIXTURES.md` (seed), `docs/RUNBOOKS/RELEASE.md` (deploy).

---

## STORAGE — Cloudflare R2 media registry (bytes in R2, identity in SQL)

Plan: bytes in **Cloudflare R2**, identity in the **`media.assets`** SQL registry (migration `0025`),
gateway is the **sole minter/signer**. Buckets `faazio-public` / `faazio-private` behind
`https://img.faazio.in`. Authority: `docs/architecture/db-schema.md §12.16`,
`caching-cloudflare-valkey.md §5/§8`, `monolith-breakdown.md §1`.

| Phase | Scope | Status |
|-------|-------|--------|
| 1 | `0025_media_assets.sql` — `media.assets` + owner link columns + purge trigger + RLS | 🟢 `a911507` |
| 2 | `internal/platform/r2` SigV4 presigner + `internal/media` context + endpoints + wiring | 🟢 `a911507` |
| 3 | Pharma Rx storage repointed R2-first (Supabase fallback) | 🟢 `a911507` |
| 4 | Product/store/menu image **link** + read join (`MediaReader`, `PUT /seller/stores/{id}/cover`) | 🟢 `410bee7` |
| 5 | Portal upload/resolve cutover to gateway media (`r2:<key>`, `saveProductImage`) | 🟢 `410bee7` |
| 6 | Mobile `GatewayClient` media methods | ⬜ **skipped** — dead code for current flows (gateway returns CDN URLs; Rx stays on the signed-URL endpoint) |
| 7 | R2 **backfill** of unsplash seed + `generate.mjs` emits `media.assets`/`image_key` | 🔵 code built (`seed/lib/*`, `seed/backfill_r2.mjs`, `generate.mjs`); 🔴 run needs R2 credentials |
| 8 | GC sweeper (orphaned DRAFT) + Cloudflare CDN purge worker + delete purge signal (`0026`) | 🟢 shipped |

### Phase 0 — Cloudflare ops (manual, 🔴 blocked — needs account access)
Prereqs for any live upload/backfill to succeed (see `docs/RUNBOOKS/DATA_FIXTURES.md`):
- [ ] Create R2 buckets `faazio-public` (public) and `faazio-private` (private).
- [ ] Attach custom domain `img.faazio.in` to `faazio-public`; add a Cache Rule
      `max-age=31536000, immutable` (keys are content-addressed).
- [ ] R2 CORS: allow `PUT` from the gateway + portal origins, `Content-Type` header.
- [ ] Provision an R2 API token (S3 creds) → set `R2_ACCOUNT_ID`/`R2_ACCESS_KEY_ID`/
      `R2_SECRET_ACCESS_KEY`/`R2_PUBLIC_BUCKET`/`R2_PRIVATE_BUCKET`/`R2_CDN_BASE` on the gateway and
      `NEXT_PUBLIC_MEDIA_CDN_BASE` on the portal.

### Phase 7 — run the backfill (🔴 blocked — needs Phase 0 creds)
```bash
R2_ACCOUNT_ID=… R2_ACCESS_KEY_ID=… R2_SECRET_ACCESS_KEY=… \
  node server/supabase/seed/backfill_r2.mjs          # writes media_manifest.json + backfill_media.sql
# apply backfill_media.sql to the DB, then regenerate the committed seed:
node server/supabase/seed/generate.mjs               # 0001_seed.sql now emits media.assets + image_key
```
`media_manifest.json` is committed; `backfill_media.sql` is a generated ops artifact (git-ignored).

### Phase 8 — GC + purge (🟢 shipped, `0026`)
- **GC sweeper** (`internal/media/sweeper.go`) — deletes orphaned `DRAFT` assets past a 24 h TTL (R2
  object + row), every 6 h; admin `POST /media/gc` runs one pass. Unit-tested with fakes.
- **CDN purge worker** (`internal/media/purger.go`) — `LISTEN media_updated` and purges the affected
  CDN URL via `internal/platform/cloudflare` (`CF_ZONE_ID`/`CF_API_TOKEN`, ≤30 files/req, best-effort).
- **Migration `0026_media_gc.sql`** — a DELETE trigger carries the old `r2_key` so a removed/reclaimed
  asset is purged. `r2.DeleteObject` (presigned DELETE) is the one server-initiated object delete.

---

## OTHER — repo-level open items

- **Auth.** App auth stays **mocked** (`authStore.login()`) by product decision; Supabase phone-OTP
  cutover is not scheduled. Server still attaches a bearer when a session is present. Consequence
  (W49): the two app writes behind `auth.Require` — `POST /ads/events` (paid-ad KPIs) and
  `PUT /vendors/{id}/rating` (server-durable rating) — are inert on a production
  `AUTH_DISABLED=false` gateway; the client is now honest/observable about it (confirmed-only ad
  boolean, rating `synced`/`offline`/`signed-out`/`not-verified`) and local dev closes both via
  `AUTH_DISABLED=true` + `DEV_USER`.
- **Mobile media plumbing.** Intentionally none — the gateway resolves `image_key → CDN URL` on every
  catalog/directory/SDUI read, so no `GatewayClient` media methods are needed. Revisit only if the app
  gains an upload surface (e.g. seller-on-mobile, Rx capture).
- **Razorpay native checkout.** Mock adapter seam (`client/mobile/src/services/payments/checkout.ts`);
  needs the SDK adapter + a real publishable key. No screen change. (See mobile backlog W22.)
- **Editorial `@data` rails.** Hero banners / brand campaigns / Pharma rails are now server-owned
  through the SDUI doc (W42 heroes; W50 campaigns on `hotBrandDeals.campaigns[]` → anon
  `GET /home/campaigns(/{id})`, and Pharma `pharmaHero`/`pharmaPopular`/`pharmaEssentials` →
  `GET /sdui/pharma`); the `@data`/feature fixtures remain offline fallbacks. (See mobile
  backlog W50.)
- **Checkout festival-discount settlement — fixed.** `internal/checkout` now re-prices through
  `contracts.DiscountReader` (`internal/promo.Repo.ActiveDiscounts`), so the charged amount matches
  the festival price the app overlays (`promo.active-discounts`). Coupons settle through
  `contracts.CouponValidator` as before.
- **Seed ↔ Mongo SDUI drift — fixed.** `generate.mjs` now owns the W38 `martHero` + `martEssentials`
  Mongo SDUI sections (`MART_SDUI` splice: hero above `adBanner`, essentials after `dealsOfDay`), so
  re-running the generator reproduces the committed `seed/mongo/sdui_layouts.json` byte-for-byte.