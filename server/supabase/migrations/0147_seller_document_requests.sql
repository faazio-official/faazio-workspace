-- Faazio MVP — admin "request a document" for a seller application.
-- Authority: docs/architecture/db-schema.md §12, monolith-breakdown.md §1 (sellers row).
--
-- Product rule: instead of an admin replacing a seller's KYC document themselves, the district/super
-- admin asks the applicant to (re)upload it. The applicant sees the request on the customer-app
-- "Sell with us" screen, uploads the file from their own device, and the fulfilment clears the
-- request and writes the new sellers.kyc_documents row (unverified, so it re-enters review).
--
-- One row per request. At most one PENDING request per seller+doc_type (partial unique index), so a
-- repeated admin tap cannot queue duplicates.

create table if not exists sellers.document_requests (
  request_id      text primary key,
  seller_id       text not null references sellers.sellers (seller_id) on delete cascade,
  doc_type        kyc_doc_type not null,
  status          text not null default 'PENDING'
                    check (status in ('PENDING', 'FULFILLED', 'CANCELLED')),
  note            text not null default '',
  requested_by    text not null default '',
  requested_at    timestamptz not null default now(),
  fulfilled_at    timestamptz,
  fulfilled_kyc_id text
);

create index if not exists seller_document_requests_seller_idx
  on sellers.document_requests (seller_id, requested_at desc);
create index if not exists seller_document_requests_status_idx
  on sellers.document_requests (status, requested_at desc);

create unique index if not exists seller_document_requests_one_pending_idx
  on sellers.document_requests (seller_id, doc_type)
  where status = 'PENDING';

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'auth')
     and exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant select on sellers.document_requests to authenticated;
    execute 'alter table sellers.document_requests enable row level security';
    execute 'drop policy if exists document_request_read on sellers.document_requests';
    execute $p$create policy document_request_read on sellers.document_requests for select to authenticated
      using (seller_id = sellers.current_seller_id()
             or sellers.is_super()
             or exists (
               select 1 from sellers.sellers s
                where s.seller_id = document_requests.seller_id
                  and sellers.is_state_admin_for(s.state_code))) $p$;
  end if;
end;
$$;
