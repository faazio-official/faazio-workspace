-- Faazio — SDUI control plane: versioned screen layouts, district pointers and the first
-- PAN_INDIA FOOD home layout (migration 0148).
--
-- Authority: docs/architecture/db-schema.md §12.46, docs/architecture/monolith-breakdown.md §1
-- (sdui context), docs/architecture/caching-cloudflare-valkey.md (sdui keys).
--
-- Why: the legacy SDUI document stored one mutable section list per screen, so there was no
-- history, no district targeting and no way to roll back a broken banner. This migration replaces
-- the write model with an append-only version table plus a pointer table:
--
--   admins.sdui_layout_versions  every published payload, immutable, JSONB, one row per version
--   admins.sdui_layout_pointers  the live pointer per (vertical, screen, district) + epoch
--
-- district_id is NULL for the PAN_INDIA fallback row, so every district always resolves to a
-- layout even when it has no override. Payloads are validated in Go (internal/sdui/control.go)
-- before insert; the DB only enforces shape/identity.
--
-- Idempotent: table creation guarded, seed uses fixed ids + ON CONFLICT DO NOTHING.

begin;

create table if not exists admins.sdui_layout_versions (
  id             uuid primary key default gen_random_uuid(),
  vertical       text not null check (vertical in ('home', 'food', 'mart', 'grocery', 'pharma')),
  screen         text not null check (screen in ('home', 'category_landing')),
  district_id    text references admins.district_master (district_code) on delete restrict,
  version_num    integer not null check (version_num > 0),
  schema_version text not null,
  payload        jsonb not null,
  note           text,
  published_by   text,
  published_at   timestamptz not null default now()
);

comment on table admins.sdui_layout_versions is
  'Append-only SDUI screen payloads. district_id NULL = PAN_INDIA fallback. Written only by the gateway after strict validation.';

create unique index if not exists sdui_layout_versions_scope_version_idx
  on admins.sdui_layout_versions (vertical, screen, coalesce(district_id, 'PAN_INDIA'), version_num);

create index if not exists sdui_layout_versions_recent_idx
  on admins.sdui_layout_versions (vertical, screen, published_at desc);

create table if not exists admins.sdui_layout_pointers (
  vertical    text not null check (vertical in ('home', 'food', 'mart', 'grocery', 'pharma')),
  screen      text not null check (screen in ('home', 'category_landing')),
  district_id text references admins.district_master (district_code) on delete restrict,
  version_id  uuid not null references admins.sdui_layout_versions (id) on delete restrict,
  epoch       bigint not null default 1,
  updated_by  text,
  updated_at  timestamptz not null default now()
);

comment on table admins.sdui_layout_pointers is
  'Live SDUI layout per (vertical, screen, district). district_id NULL = PAN_INDIA fallback. epoch bumps on every publish/rollback for client kill-switch polling.';

create unique index if not exists sdui_layout_pointers_scope_idx
  on admins.sdui_layout_pointers (vertical, screen, coalesce(district_id, 'PAN_INDIA'));

-- Seed: one live FOOD home layout under the PAN_INDIA fallback. The payload mirrors the approved
-- ROYAL FEAST / FESTIVE40 reference (maroon header theme, gold hero copy). This is bootstrap data:
-- the gateway serves it until a super admin publishes over it.
insert into admins.sdui_layout_versions
  (id, vertical, screen, district_id, version_num, schema_version, payload, note, published_by)
values (
  '5d0c3f7e-1a41-4c8e-9a77-0148f00d0001',
  'food', 'home', null, 1, '1.2',
  $json${
    "schema_version": "1.2",
    "header_theme": {
      "background_hex": "#2B0909",
      "search_bar_bg_hex": "#421414",
      "status_bar_style": "light"
    },
    "widgets": [
      {
        "widget_id": "hero_rush_091",
        "type": "HERO_PROMO_BANNER",
        "slot": "hero_banner",
        "priority": 1,
        "copy": {
          "eyebrow": "ROYAL FEAST",
          "headline": "Flat 40% OFF",
          "accent_headline": "40%",
          "code_label": "CODE:",
          "code": "FESTIVE40",
          "cta": "Order Now"
        },
        "schedule": {
          "starts_at_utc": "2026-11-01T00:00:00Z",
          "expires_at_utc": "2026-12-31T18:29:00Z",
          "on_expire_action": "SWAP_TO_FALLBACK",
          "fallback_widget_id": "hero_default_001"
        },
        "action": {
          "type": "DEEP_LINK",
          "route": "faazio://food/offers/FESTIVE40",
          "auto_apply_coupon": "FESTIVE40"
        }
      },
      {
        "widget_id": "hero_default_001",
        "type": "HERO_PROMO_BANNER",
        "slot": "hero_banner",
        "priority": 2,
        "copy": {
          "eyebrow": "FAAZIO DELIVERS",
          "headline": "Hot meals, 30 minutes",
          "code_label": "",
          "code": "",
          "cta": "Browse restaurants"
        },
        "action": {
          "type": "NONE",
          "route": ""
        }
      }
    ]
  }$json$::jsonb,
  'Bootstrap PAN_INDIA food home layout (ROYAL FEAST / FESTIVE40)',
  'system'
)
on conflict (id) do nothing;

insert into admins.sdui_layout_pointers (vertical, screen, district_id, version_id, epoch, updated_by)
values ('food', 'home', null, '5d0c3f7e-1a41-4c8e-9a77-0148f00d0001', 1, 'system')
on conflict do nothing;

commit;
