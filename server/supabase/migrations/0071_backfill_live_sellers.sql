-- Faazio MVP — backfill live seller ownership so every store has an owner, then enforce NOT NULL.
-- Authority: docs/architecture/db-schema.md §directory, monolith-breakdown.md §1.
--
-- Why: the live database has one seller account (sel-tiruchi-01) and 32 stores, every one of them
-- with a NULL seller_id (0015:75 left the column nullable and nothing ever wrote it). The seller
-- console therefore shows an empty vendor list and no product can be scoped to an owner.
--
-- This migration:
--   1. seeds a small set of multi-vendor accounts so the switcher is demonstrable,
--   2. assigns every existing store to an owning account,
--   3. links the existing login to the account that owns the Tiruchirappalli stores,
--   4. enforces NOT NULL on directory.stores.seller_id.
--
-- Idempotent: safe to re-run (inserts are ON CONFLICT DO NOTHING, updates are guarded).

-- ---------------------------------------------------------------- multi-vendor accounts
-- sel-tiruchi-01 already exists (0063/0064) and keeps its identity. The rest are new accounts that
-- deliberately span brands, which is the whole point of the account/vendor split.
insert into sellers.sellers
  (seller_id, business_name, owner_name, category, gstin, pan, address, phone, contact_email,
   state_code, district_code, status, platform_fee_pct)
values
  ('sel-tiruchi-01', 'Faazio Mart Tiruchirappalli', 'Faazio Retail Pvt Ltd', 'MART',
   '', '', '', null, '', 'TN', 'TTC', 'ACTIVE', 10),
  ('sel-trichy-foods', 'Trichy Hospitality Group', 'R. Sundaram', 'FOOD',
   '', '', '', null, '', 'TN', 'TTC', 'ACTIVE', 8),
  ('sel-trichy-health', 'Trichy Health Retail', 'K. Meenakshi', 'PHARMA',
   '', '', '', null, '', 'TN', 'TTC', 'ACTIVE', 7),
  ('sel-trichy-retail', 'Trichy Neighbourhood Retail', 'S. Arun', 'MART',
   '', '', '', null, '', 'TN', 'TTC', 'ACTIVE', 11)
on conflict (seller_id) do nothing;

-- ---------------------------------------------------------------- store ownership
-- Explicit, reviewable mapping. Every store gets exactly one owner; the accounts above are chosen so
-- that at least three of them own vendors in more than one app (the switcher's reason to exist).
update directory.stores d set seller_id = m.seller_id
  from (values
    -- Trichy Hospitality Group: Food kitchens + one Mart grocery counter (multi-brand account).
    ('store-f1',  'sel-trichy-foods'), ('store-f2',  'sel-trichy-foods'),
    ('store-f3',  'sel-trichy-foods'), ('store-f4',  'sel-trichy-foods'),
    ('store-f5',  'sel-trichy-foods'), ('store-f6',  'sel-trichy-foods'),
    ('store-g1',  'sel-trichy-foods'),
    -- Trichy Health Retail: pharmacies + one Mart wellness shop (multi-brand account).
    ('store-p1',  'sel-trichy-health'), ('store-p2', 'sel-trichy-health'),
    ('store-p3',  'sel-trichy-health'), ('store-p4', 'sel-trichy-health'),
    ('store-m5',  'sel-trichy-health'),
    -- Faazio Mart Tiruchirappalli: the existing account, Mart + Food.
    ('store-m1',  'sel-tiruchi-01'), ('store-m2',  'sel-tiruchi-01'),
    ('store-m3',  'sel-tiruchi-01'), ('store-m4',  'sel-tiruchi-01'),
    ('store-m6',  'sel-tiruchi-01'), ('store-m7',  'sel-tiruchi-01'),
    ('store-f7',  'sel-tiruchi-01'),
    -- Trichy Neighbourhood Retail: remaining Mart + Food + Pharma.
    ('store-m8',  'sel-trichy-retail'), ('store-m9',  'sel-trichy-retail'),
    ('store-m10', 'sel-trichy-retail'), ('store-m11', 'sel-trichy-retail'),
    ('store-m12', 'sel-trichy-retail'), ('store-m13', 'sel-trichy-retail'),
    ('store-f8',  'sel-trichy-retail'), ('store-f9',  'sel-trichy-retail'),
    ('store-f10', 'sel-trichy-retail'), ('store-f11', 'sel-trichy-retail'),
    ('store-f12', 'sel-trichy-retail'),
    ('store-p5',  'sel-trichy-retail'), ('store-p6',  'sel-trichy-retail')
  ) as m(store_id, seller_id)
 where d.id = m.store_id
   and (d.seller_id is null or d.seller_id = '');

-- Any store the mapping above did not name still needs an owner before NOT NULL can land. Fall back
-- to the incumbent account so the constraint is satisfiable; the mapping is the intended state.
update directory.stores
   set seller_id = 'sel-tiruchi-01'
 where seller_id is null or seller_id = '';

-- ---------------------------------------------------------------- per-vendor commercial fields
-- Fee is per shop, so the values must actually differ per shop — otherwise the per-vendor fee model
-- is untestable and the console shows one number everywhere. FOOD has a 5% floor (handler rule).
update directory.stores d set platform_fee_pct = m.fee
  from (values
    ('store-f1', 8), ('store-f2', 6), ('store-f3', 7), ('store-f4', 9),
    ('store-f5', 5), ('store-f6', 8), ('store-f7', 6), ('store-f8', 7),
    ('store-f9', 5), ('store-f10', 9), ('store-f11', 8), ('store-f12', 6),
    ('store-m1', 12), ('store-m2', 11), ('store-m3', 10), ('store-m4', 13),
    ('store-m5', 9),  ('store-m6', 8),  ('store-m7', 14), ('store-m8', 10),
    ('store-m9', 12), ('store-m10', 15), ('store-m11', 11), ('store-m12', 13),
    ('store-m13', 10), ('store-g1', 7),
    ('store-p1', 7), ('store-p2', 6), ('store-p3', 8), ('store-p4', 7),
    ('store-p5', 6), ('store-p6', 9)
  ) as m(store_id, fee)
 where d.id = m.store_id;

-- Safety net for any row the explicit map missed: keep FOOD above its floor, others at the default.
update directory.stores set platform_fee_pct = 5  where app = 'FOOD' and platform_fee_pct < 5;

-- ---------------------------------------------------------------- enforce ownership
alter table directory.stores alter column seller_id set not null;

-- ---------------------------------------------------------------- link the existing login
-- One account may have many logins (admins.portal_users.seller_id). The existing SELLER login keeps
-- pointing at the incumbent account; the new accounts are reachable by admins for demonstration.
update admins.portal_users
   set seller_id = 'sel-tiruchi-01'
 where role::text = 'SELLER' and (seller_id is null or seller_id = '');
