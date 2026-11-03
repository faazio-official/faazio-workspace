-- Faazio MVP — seller ACCOUNT becomes brand-agnostic (one account → many vendors across apps).
-- Authority: docs/architecture/db-schema.md §sellers, docs/architecture/monolith-breakdown.md §1.
--
-- Why: a seller account is a business identity (GSTIN/PAN/bank/KYC). The app brand (MART/FOOD/
-- PHARMA), the platform fee, the taxonomy category and FSSAI belong to the SHOP, not the account.
-- A single account may therefore own a Mart shop and a Food restaurant at the same time.
--
-- This migration only relaxes the account-level constraint. The vendor-level columns land in 0069.
-- The account-level `category` column is kept nullable as a transitional default until every client
-- stops sending it; a later migration drops it.
--
-- Idempotent: safe to re-run.

-- ---------------------------------------------------------------- account is brand-agnostic
-- `category` was NOT NULL app_brand. It is now meaningless at account level (an account can span
-- brands), so relax it. New code derives the brand from each vendor; the column is transitional.
alter table sellers.sellers alter column category drop not null;

-- ---------------------------------------------------------------- contact_email is an identity key
-- 0039 added contact_email but never made it unique, so two accounts can claim the same address.
-- A seller signs in / is contacted by this address, so it must be a real identity key. Partial
-- index: empty string is "not provided" and must not collide.
create unique index if not exists sellers_contact_email_lower_uniq
  on sellers.sellers (lower(contact_email))
  where contact_email is not null and contact_email <> '';

-- ---------------------------------------------------------------- vendor count helper
-- The seller console needs "how many vendors does this account own" without a second round trip
-- per row. A view keeps it a single read and stays correct as stores are added/removed.
create or replace view sellers.seller_vendor_counts as
  select s.seller_id,
         count(d.id)::int as vendor_count
    from sellers.sellers s
    left join directory.stores d on d.seller_id = s.seller_id
   group by s.seller_id;

comment on view sellers.seller_vendor_counts is
  'Vendors (directory.stores) owned per seller account. Source for the seller console switcher.';
