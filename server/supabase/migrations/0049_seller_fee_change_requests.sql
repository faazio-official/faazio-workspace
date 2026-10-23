-- Faazio MVP — seller-initiated platform-fee change requests with an audited review queue.
-- Authority: docs/architecture/db-schema.md §12, monolith-breakdown.md §1 (sellers row).
--
-- Product rule: the platform fee is set once at registration and is immutable by the seller. A
-- seller may only REQUEST a change; a district admin (their district) or a super admin approves or
-- rejects it. Approval copies requested_fee_pct onto sellers.sellers.platform_fee_pct in the same
-- transaction, and both the request row and admins.audit_logs keep the trail.
--
-- One row per decision. A seller may have at most one PENDING request at a time (partial unique
-- index), so repeated taps cannot flood the review queue.

create table if not exists sellers.seller_fee_change_requests (
  request_id      text primary key,
  seller_id       text not null references sellers.sellers (seller_id) on delete cascade,
  district_code   text references admins.district_master (district_code) on delete set null,
  current_fee_pct smallint not null check (current_fee_pct between 1 and 100),
  requested_fee_pct smallint not null check (requested_fee_pct between 1 and 100),
  status          text not null default 'PENDING'
                    check (status in ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  admin_note      text not null default '',
  requested_at    timestamptz not null default now(),
  reviewed_by     text,
  reviewed_at     timestamptz,
  review_reason   text not null default ''
);

create index if not exists seller_fee_requests_seller_idx
  on sellers.seller_fee_change_requests (seller_id, requested_at desc);
create index if not exists seller_fee_requests_status_idx
  on sellers.seller_fee_change_requests (status, requested_at desc);
create index if not exists seller_fee_requests_district_idx
  on sellers.seller_fee_change_requests (district_code, status, requested_at desc);

create unique index if not exists seller_fee_requests_one_pending_idx
  on sellers.seller_fee_change_requests (seller_id)
  where status = 'PENDING';

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'auth')
     and exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant select on sellers.seller_fee_change_requests to authenticated;
    execute 'alter table sellers.seller_fee_change_requests enable row level security';
    execute 'drop policy if exists fee_request_read on sellers.seller_fee_change_requests';
    execute $p$create policy fee_request_read on sellers.seller_fee_change_requests for select to authenticated
      using (seller_id = sellers.current_seller_id()
             or sellers.is_super()
             or exists (
               select 1 from sellers.sellers s
                where s.seller_id = seller_fee_change_requests.seller_id
                  and sellers.is_state_admin_for(s.state_code))) $p$;
  end if;
end;
$$;
