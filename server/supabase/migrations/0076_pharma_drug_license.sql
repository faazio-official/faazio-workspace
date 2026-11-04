-- Faazio MVP — the PHARMA shop's drug-selling licence becomes a first-class store field.
-- Authority: docs/architecture/db-schema.md §directory, docs/architecture/monolith-breakdown.md §1.
--
-- Why: directory.stores is the VENDOR (the real shop/restaurant/pharmacy). FOOD shops carry
-- fssai_number/fssai_cert_key/fssai_cert_asset_id (0069); PHARMA shops should likewise carry their
-- drug licence (number + certificate + asset id). The web onboarding and the seller console already
-- capture the licence; previously it was thrown away because directory.stores had no columns.
-- Opt-in: the licence is NOT required to create a pharmacy vendor — shops may attach it later from
-- the Stores console.
--
-- Idempotent: safe to re-run.
alter table directory.stores add column if not exists drug_license_number         text not null default '';
alter table directory.stores add column if not exists drug_license_cert_key       text not null default '';
alter table directory.stores add column if not exists drug_license_cert_asset_id  text not null default '';