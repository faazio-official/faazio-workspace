-- Faazio MVP — audit-log retention: admins.audit_logs becomes a rolling 7-day window.
-- DELETE >7d for ALL roles (SELLER/STATE_ADMIN/SUPER_ADMIN); no archive.
-- Authority: docs/architecture/db-schema.md §12.9/§12.20, monolith-breakdown.md §1 (admins row),
-- caching-cloudflare-valkey.md §8 (audit never cached — purge is an origin delete),
-- web-portal.md (audit-log copy), mvp-backend.md §12 (entry 20), RUNBOOKS/TROUBLESHOOTING.md.
--
-- WHAT CHANGES: 0015 shipped admins.audit_logs as append-only by convention — no RLS UPDATE/DELETE
-- policy — so the portal promise "nothing here can be edited or deleted" held forever. That is now a
-- rolling window: rows older than max_age (default 7 days) are deleted nightly. The portal stays
-- read-only (still no UPDATE/DELETE policy); retention is enforced only by this function + the
-- gateway worker.
--
-- SCHEDULER (superadmin decision, 2026-10): NOT pg_cron. The nightly 00:00 IST pass runs as a
-- background worker inside the Go gateway on Render (main.go → admins.NewPurger(...).Run(workerCtx));
-- pg_cron on the Supabase side is optional and NOT scheduled here so the two schedulers can never
-- double-fire. The 18:30 UTC (00:00 IST) pg_cron alternative, if a team ever wants it, is:
--   select cron.unschedule('faazio-purge-audit-logs');
--   select cron.schedule('faazio-purge-audit-logs', '30 18 * * *', 'select admins.purge_audit_logs();');
-- idempotent (unschedule before schedule), like 0014's checkout.purge_idempotency_keys.
--
-- WHY SECURITY DEFINER + pg_catalog search_path: the postgres role / psql manual trigger must be
-- able to run the purge WITHOUT ever granting DELETE to authenticated/anon and without adding an RLS
-- delete policy. The gateway's service_role already bypasses RLS and calls this function every pass.
--
-- BATCHING: a first-run mass delete of months of history must not hold one long lock; each pass
-- deletes in chunk_limit rows (ctid-subselect, same shape as media gcBatch=200) and reports a total.

create or replace function admins.purge_audit_logs(max_age interval default interval '7 days')
returns integer language plpgsql security definer
set search_path = pg_catalog as $$
declare
  total integer := 0;
  del   integer;
begin
  loop
    delete from admins.audit_logs
      where ctid in (
        select a.ctid
          from admins.audit_logs a
         where a.created_at < now() - max_age
         limit 2000
      );
    get diagnostics del = row_count;
    total := total + del;
    exit when del < 2000;
  end loop;
  return total;
end;
$$;