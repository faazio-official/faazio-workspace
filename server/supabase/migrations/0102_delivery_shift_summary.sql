-- Faazio MVP — delivery rider shift summary (today's credited earnings + worked time).
-- Authority: docs/architecture/db-schema.md (§12.23 delivery.*), monolith-breakdown.md §1 (delivery
-- row), user-interaction-workflow/delivery/availability/index.md.
--
-- Why: the Feed "This shift" grid had only rider-record fields (completed / load / rating) because
-- no source of truth existed for per-shift earnings or online time. Earnings (money) are durable on
-- the rider row and credited on DROP → DELIVERED. Worked time is counted live in Valkey
-- (delivery:rider:{id}:shift:since + :online:{day}) and rolled up here into `rider_shift_days` when
-- the IST day turns, so the hot path never writes a Postgres row per heartbeat. Aggregates only —
-- no PII.
--
-- Additive and idempotent; apply from a dev terminal per docs/RUNBOOKS/DATABASE_MIGRATIONS.md.
-- Never auto-run on Render.

alter table delivery.delivery_boys
  add column if not exists shift_earnings_paisa int4 not null default 0
    check (shift_earnings_paisa >= 0),
  add column if not exists shift_reset_at date;

comment on column delivery.delivery_boys.shift_earnings_paisa is
  'Today''s credited rider earnings in paisa; reset when shift_reset_at rolls to a new IST day.';
comment on column delivery.delivery_boys.shift_reset_at is
  'Last IST calendar day the shift aggregates were reset (NULL until the first shift read).';

create table if not exists delivery.rider_shift_days (
  rider_id       text not null references delivery.delivery_boys (rider_id) on delete cascade,
  shift_date     date not null,
  online_seconds int4 not null default 0 check (online_seconds >= 0),
  earnings_paisa int4 not null default 0 check (earnings_paisa >= 0),
  created_at     timestamptz not null default now(),
  primary key (rider_id, shift_date)
);
create index if not exists rider_shift_days_date_idx
  on delivery.rider_shift_days (shift_date);

comment on table delivery.rider_shift_days is
  'Completed worked-day roll-up per rider (Valkey holds the in-progress day). Aggregates only.';

-- RLS + grants (Supabase only). The gateway (service_role) is the only writer; riders read their own
-- rows and state/super admins read rows in scope, mirroring delivery_boys.
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'auth')
     or not exists (select 1 from pg_roles where rolname = 'authenticated') then
    raise notice 'auth schema or Supabase roles absent — skipping 0102 RLS + grants (non-Supabase environment)';
    return;
  end if;

  grant select on delivery.rider_shift_days to authenticated;

  alter table delivery.rider_shift_days enable row level security;

  execute 'drop policy if exists rider_shift_days_read on delivery.rider_shift_days';
  execute $p$create policy rider_shift_days_read on delivery.rider_shift_days for select to authenticated
    using (rider_id = delivery.current_rider_id()
           or delivery.is_super()
           or exists (select 1 from delivery.delivery_boys b
                       where b.rider_id = rider_shift_days.rider_id
                         and delivery.is_state_admin_for(b.state_code)))$p$;
end $$;
