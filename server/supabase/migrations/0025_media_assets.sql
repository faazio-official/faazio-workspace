-- Faazio MVP — enterprise media registry: bytes in Cloudflare R2, identity in SQL.
-- Authority: docs/architecture/db-schema.md §12.16, mvp-backend.md §1 (R2), monolith-breakdown.md §1,
-- caching-cloudflare-valkey.md §5/§8.
--
-- Why: every image *write* pipeline today is broken or bypasses the gateway — the portal uploads to
-- Supabase Storage and the gateway never links the key (orphaned upload), store/menu images are
-- free-text URLs with no control, and seed rows hotlink unsplash. This migration gives each image one
-- identity row so it can be minted, deduped (sha256), moderated (DRAFT/ACTIVE/REJECTED), linked to an
-- owner, audited, and garbage-collected — while the bytes live in R2 (never BYTEA in Postgres, never a
-- data-URL, never an image BSON in Mongo).
--
-- Additive only (never rewrites 0001–0024): new `media` schema + nullable owner link columns. Existing
-- `image_url`/`cover_image`/`image` text columns stay until the R2 backfill populates `*_key`, so no
-- read path breaks mid-migration.
--
-- Inherits the lean dtype policy (§2): ids = TEXT slug, sha256 hex = TEXT, counts/sizes = INT8,
-- time = TIMESTAMPTZ, enums = native ENUM, writes = service_role. Idempotent — safe to re-run.

create schema if not exists media;

do $$ begin
  create type asset_kind as enum ('PUBLIC', 'PRIVATE');
exception when duplicate_object then null; end $$;

do $$ begin
  create type asset_status as enum ('DRAFT', 'ACTIVE', 'REJECTED');
exception when duplicate_object then null; end $$;

-- ================================================================ media.assets (single ID authority)
create table if not exists media.assets (
  id            text primary key,                 -- 'img_*' minted by the gateway
  owner_type    text not null default '',          -- PRODUCT|STORE|MENU|BRAND|BANNER|AVATAR|PRESCRIPTION|KYC|''
  owner_id      text not null default '',
  kind          asset_kind not null,
  bucket        text not null,                     -- R2 bucket name (public or private)
  r2_key        text not null,                     -- immutable content-addressed object key
  mime          text not null default '',          -- validated image/* allowlist at the handler
  bytes         int8 not null default 0 check (bytes >= 0),
  width         int4 check (width  is null or width  > 0),
  height        int4 check (height is null or height > 0),
  hash          text,                              -- sha256 hex; NULL when the client cannot compute it
  status        asset_status not null default 'DRAFT',
  created_by    text not null default '',          -- app user / seller slug (service_role writes only)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint media_assets_owner_type_chk check (
    owner_type in ('', 'PRODUCT', 'STORE', 'MENU', 'BRAND', 'BANNER', 'AVATAR', 'PRESCRIPTION', 'KYC')
  )
);

-- One row per content hash (dedup). NULL hashes are distinct in Postgres so un-hashed rows still insert.
create unique index if not exists media_assets_r2_key_uniq on media.assets (r2_key);
create unique index if not exists media_assets_hash_uniq   on media.assets (hash);
create index if not exists media_assets_owner_idx  on media.assets (owner_type, owner_id);
create index if not exists media_assets_status_idx on media.assets (status, created_at desc);

-- ================================================================ owner link columns (nullable → backfill)
-- The owning context writes the key + asset id when a seller/admin sets an image; the read path
-- resolves `*_key` → `${CDN_BASE}/${r2_key}` (media/repo). `image_url`/`cover_image`/`image` stay as the
-- offline/legacy fallback until Phase 7 backfills every row.
alter table catalog.products   add column if not exists image_key        text;
alter table catalog.products   add column if not exists image_asset_id   text;
alter table directory.stores   add column if not exists cover_image_key  text;
alter table directory.stores   add column if not exists cover_image_asset_id text;
alter table directory.menus    add column if not exists image_key        text;
alter table directory.menus    add column if not exists image_asset_id   text;

-- ================================================================ purge signal
-- The gateway purges `faazio:v1:media:asset:{id}` on confirm/status/delete and asks Cloudflare to purge
-- the CDN URL by key. NOTIFY is best-effort (caching-cloudflare-valkey.md §5).
create or replace function media.notify_asset_change()
returns trigger
language plpgsql
as $$
begin
  perform pg_notify('media_updated', json_build_object(
    'id', new.id, 'status', new.status, 'r2_key', new.r2_key, 'kind', new.kind)::text);
  return new;
end;
$$;

drop trigger if exists media_asset_notify on media.assets;
create trigger media_asset_notify
  after insert or update of status, r2_key on media.assets
  for each row execute function media.notify_asset_change();

-- Reuse the generic updated_at touch from 0014.
drop trigger if exists touch_updated_at on media.assets;
create trigger touch_updated_at before update on media.assets
  for each row execute function util.touch_updated_at();

-- ================================================================ RLS + grants (Supabase only)
-- The gateway connects as service_role (bypasses RLS) and is the only mint/sign/confirm authority.
-- These policies are defence-in-depth for a direct Supabase anon/authenticated client: anon may read
-- only ACTIVE PUBLIC assets (safe CDN-backed business data), and a creator may read their own row
-- (including a PRIVATE draft). Writes are service_role only — there is no insert/update policy.
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'auth')
     or not exists (select 1 from pg_roles where rolname = 'authenticated') then
    raise notice 'auth schema or Supabase roles absent — skipping 0025 RLS + grants (non-Supabase environment)';
    return;
  end if;

  grant usage on schema media to anon, authenticated;
  grant select on media.assets to anon, authenticated;

  alter table media.assets enable row level security;

  execute 'drop policy if exists media_public_read on media.assets';
  execute $p$create policy media_public_read on media.assets for select to anon, authenticated
    using (status = 'ACTIVE' and kind = 'PUBLIC')$p$;

  execute 'drop policy if exists media_owner_read on media.assets';
  execute $p$create policy media_owner_read on media.assets for select to authenticated
    using (created_by <> '' and created_by = coalesce(auth.jwt() ->> 'seller_id', auth.jwt() ->> 'sub', ''))$p$;
end;
$$;