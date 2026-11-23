-- Faazio MVP — merge the public "Sell with us" leads into sellers.sellers.
-- Authority: docs/architecture/db-schema.md §12.42, monolith-breakdown.md §1 (sellers row),
-- user-interaction-workflow/seller/onboarding/seller-web-intake.md.
--
-- Why: 0111–0113 created a parallel sellers.seller_leads table with its own lifecycle
-- (NEW/CONTACTED/APPROVED/REJECTED), its own admin queue and its own portal pages. A landing-page
-- enquiry and an app application are the same merchant at two different depths of the same funnel, so
-- they now share ONE row: a web submission creates sellers.sellers with status = INQUIRY and
-- source = 'web'; the merchant completing onboarding in the app (POST /sellers, matched on contact
-- phone/email) promotes that same row to PENDING_REVIEW with source = 'app'.
--
-- Additive except the drop of the superseded lead table (its rows become INQUIRY seller rows first,
-- so no enquiry is lost).
--
-- Apply from a dev terminal per docs/RUNBOOKS/DATABASE_MIGRATIONS.md; never auto-run on Render.

-- ================================================================ 1. the INQUIRY lifecycle state
do $$ begin
  alter type seller_status add value if not exists 'INQUIRY';
exception when duplicate_object then null; end $$;

-- ================================================================ 2. provenance + inquiry payload
-- `source` records where the row came from. Existing rows are app applications (default 'app').
alter table sellers.sellers
  add column if not exists source text not null default 'app',
  -- A web enquiry is a shop, so it carries the shop-level facts the form collects. They are
  -- nullable: a full application derives category/fee from each vendor (directory.stores).
  add column if not exists inquiry_category app_brand,
  add column if not exists inquiry_platform_fee_pct smallint,
  add column if not exists inquiry_notes text,
  -- Public shop-front photos captured on the landing page before any vendor row exists. Rows are
  -- {"assetId": <media.assets id>, "key": <R2 object key>}; bytes are AVIF only.
  add column if not exists shop_photos jsonb not null default '[]'::jsonb,
  -- Operator follow-up state for an open enquiry. Distinct from seller_status: the call-back can be
  -- CONTACTED while the application is still INQUIRY. A decision moves seller_status, not this.
  add column if not exists inquiry_stage text not null default 'NEW',
  -- The admin who claimed the call-back (admins.portal_users id); empty = unclaimed.
  add column if not exists inquiry_assigned_to text not null default '',
  add column if not exists inquiry_assigned_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sellers_inquiry_stage_chk') then
    alter table sellers.sellers
      add constraint sellers_inquiry_stage_chk
      check (inquiry_stage in ('NEW', 'CONTACTED', 'APPROVED', 'REJECTED'));
  end if;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sellers_source_chk') then
    alter table sellers.sellers
      add constraint sellers_source_chk check (source in ('web', 'app'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'sellers_inquiry_fee_chk') then
    alter table sellers.sellers
      add constraint sellers_inquiry_fee_chk
      check (inquiry_platform_fee_pct is null or inquiry_platform_fee_pct between 1 and 100);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'sellers_inquiry_notes_len') then
    alter table sellers.sellers
      add constraint sellers_inquiry_notes_len
      check (inquiry_notes is null or octet_length(inquiry_notes) <= 500);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'sellers_shop_photos_arr') then
    alter table sellers.sellers
      add constraint sellers_shop_photos_arr check (jsonb_typeof(shop_photos) = 'array');
  end if;
end;
$$;

comment on column sellers.sellers.source is
  'Where the row originated: web = public /sell-with-us enquiry (status INQUIRY), app = KYC-complete application submitted from the mobile app.';
comment on column sellers.sellers.inquiry_category is
  'Shop brand chosen on the web enquiry form; becomes each vendor''s app on app completion.';
comment on column sellers.sellers.inquiry_platform_fee_pct is
  'Platform fee the enquirer expects, captured on the web form so the call-back opens with a number.';
comment on column sellers.sellers.shop_photos is
  'Public shop-front photos attached to a web enquiry before any directory.stores row exists. AVIF object keys + media.assets ids.';

-- The unified admin list filters INQUIRY rows newest-first per district.
create index if not exists sellers_district_status_created_idx
  on sellers.sellers (district_code, status, created_at desc);

-- The enquiry queue: stage + claimed owner, district-scoped, newest first.
create index if not exists sellers_inquiry_queue_idx
  on sellers.sellers (district_code, inquiry_stage, created_at desc)
  where status = 'INQUIRY';

-- ================================================================ 3. shop photos on the vendor row
-- A full application attaches at least one shop-front photo to each vendor (directory.stores).
alter table directory.stores
  add column if not exists photo_keys text[] not null default '{}',
  add column if not exists photo_asset_ids text[] not null default '{}';

comment on column directory.stores.photo_keys is
  'Public AVIF object keys for the shop-front gallery (>=1 on onboarding). Parallel to photo_asset_ids.';

-- Shop-front galleries get their own media owner type: they are neither a store banner/logo (STORE)
-- nor a private KYC document, and the claim path requires a PUBLIC AVIF draft.
alter table media.assets drop constraint if exists media_assets_owner_type_chk;
alter table media.assets add constraint media_assets_owner_type_chk check (
  owner_type in ('', 'PRODUCT', 'STORE', 'MENU', 'BRAND', 'BANNER', 'AVATAR', 'PRESCRIPTION', 'KYC', 'QR', 'SHOP')
);

-- ================================================================ 4. carry surviving leads across
-- Every lead that has not already become an application becomes an INQUIRY seller row, so the
-- operator's call-back list survives the table drop. A lead that already links to a seller
-- (seller_id IS NOT NULL) is redundant — that application row is its record.
insert into sellers.sellers
  (seller_id, business_name, owner_name, address, phone, contact_email, state_code, district_code,
   latitude, longitude, status, source, inquiry_category, inquiry_platform_fee_pct, inquiry_notes,
   rejection_reason, created_at, updated_at)
select
  'sel-' || substr(md5(l.lead_id || clock_timestamp()::text), 1, 12),
  l.business_name,
  l.owner_name,
  l.business_address,
  nullif(l.contact_phone, ''),
  l.contact_email,
  coalesce(nullif(l.state_code, ''), 'PY'),
  l.district_code,
  l.latitude,
  l.longitude,
  case when l.status = 'REJECTED' then 'REJECTED'::seller_status else 'INQUIRY'::seller_status end,
  'web',
  l.category,
  l.platform_fee_pct,
  nullif(l.notes, ''),
  case when l.status = 'REJECTED'
       then coalesce(nullif(l.admin_note, ''), 'Enquiry rejected during the web lead queue') end,
  l.created_at,
  l.updated_at
from sellers.seller_leads l
where l.seller_id is null
  and not exists (
    select 1 from sellers.sellers s
     where s.status = 'INQUIRY'
       and (s.phone = l.contact_phone or lower(coalesce(s.contact_email,'')) = lower(l.contact_email))
  );

-- ================================================================ 5. retire the lead table
drop table if exists sellers.seller_leads;
