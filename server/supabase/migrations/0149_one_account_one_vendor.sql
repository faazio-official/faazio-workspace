-- Faazio — one account, one vendor (one-account-one-vendor restructure).
-- Authority: docs/architecture/db-schema.md §sellers/§directory, docs/architecture/monolith-breakdown.md §1.
--
-- The platform previously allowed a seller ACCOUNT (sellers.sellers) to own many vendors
-- (directory.stores.seller_id, multi-brand, 0068/0069). That is retired: every account owns
-- EXACTLY ONE vendor, enforced by a unique index on directory.stores(seller_id) so no code path
-- (onboarding, super-admin create, seed) can silently reintroduce a second vendor.
--
-- Data fix: for every account holding N>1 stores, keep the OLDEST store on the original account
-- and move each newer store to a freshly created sibling account that copies the owner profile
-- (business/owner name, GSTIN, PAN, address, phone, state, district, geo, status, terms, contract,
-- compliance). Store ids never move, so vendor-attached rows (catalog.products, order_items,
-- ads store_id columns, per-store fees) stay valid; only the owning account changes. Account-scoped
-- rows (portal credentials, KYC docs, bank accounts, ads seller_id) stay with the ORIGINAL account.
-- Split accounts are profile shells: no portal credentials, empty contact_email, user_id NULL.
--
-- Idempotent: re-running only touches accounts that still hold more than one store.

do $$
declare
    rec record;
    new_id text;
begin
    for rec in
        select s.id as store_id, s.seller_id as old_seller_id
        from directory.stores s
        join (
            select seller_id
            from directory.stores
            group by seller_id
            having count(*) > 1
        ) m on m.seller_id = s.seller_id
        where s.id <> (
            select s2.id
            from directory.stores s2
            where s2.seller_id = s.seller_id
            order by s2.created_at asc, s2.id asc
            limit 1
        )
        order by s.seller_id, s.created_at asc, s.id asc
    loop
        new_id := 'sel-' || substr(md5('vendor:' || rec.store_id), 1, 10);

        if not exists (select 1 from sellers.sellers where seller_id = new_id) then
            insert into sellers.sellers (
                seller_id, business_name, owner_name, gstin, pan, address, phone,
                state_code, status, rating, contact_email, district_code, latitude, longitude,
                terms_accepted_at, terms_accepted_ip, terms_accepted_account_id,
                partner_agreement_accepted_at, partner_agreement_accepted_ip,
                partner_agreement_accepted_account_id,
                ip_license_granted_at, ip_license_granted_ip, ip_license_granted_account_id,
                contract_tier, rate_card_version, commission_pct, settlement_terms,
                compliance_status, compliance_note, source
            )
            select
                new_id,
                left(acc.business_name || ' · ' || split_part(rec.store_id, '-', -1), 120),
                acc.owner_name, acc.gstin, acc.pan, acc.address, acc.phone,
                acc.state_code, acc.status, acc.rating, '', acc.district_code,
                acc.latitude, acc.longitude,
                acc.terms_accepted_at, acc.terms_accepted_ip, acc.terms_accepted_account_id,
                acc.partner_agreement_accepted_at, acc.partner_agreement_accepted_ip,
                acc.partner_agreement_accepted_account_id,
                acc.ip_license_granted_at, acc.ip_license_granted_ip, acc.ip_license_granted_account_id,
                acc.contract_tier, acc.rate_card_version, acc.commission_pct, acc.settlement_terms,
                acc.compliance_status, acc.compliance_note, acc.source
            from sellers.sellers acc
            where acc.seller_id = rec.old_seller_id;
        end if;

        update directory.stores
        set seller_id = new_id,
            updated_at = now()
        where id = rec.store_id
          and seller_id = rec.old_seller_id;
    end loop;
end $$;

-- Hard guarantee: an account owns at most one vendor.
create unique index if not exists stores_one_per_seller_uniq
    on directory.stores (seller_id);

comment on index directory.stores_one_per_seller_uniq is
    'One account = one vendor: a seller account owns at most one store (multi-vendor retired).';

comment on view sellers.seller_vendor_counts is
    'Vendor count per seller account. Always 0 or 1 — accounts are one-account-one-vendor (0149); '
    'kept as the integrity signal surfaced in the admin seller list.';

