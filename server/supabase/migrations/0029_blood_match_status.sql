-- Faazio MVP — blood donor-match response lifecycle.
-- Authority: docs/architecture/db-schema.md §12.6, monolith-breakdown.md §1.
-- Why: a targeted donor match was insert-only (always `pending`). A recipient (donor) could never
-- respond, and the requester could never see the outcome. Add the response timestamp and let the
-- recipient transition their own incoming row; RLS is split so insert stays requester-only while the
-- donor may update their row (select already allowed both parties).
alter table blood.match_requests
  add column if not exists responded_at timestamptz;

-- ---------------------------------------------------------------- RLS (Supabase only)
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'auth') then
    raise notice 'auth schema absent — skipping match_requests RLS split (non-Supabase environment)';
    return;
  end if;

  -- Replace the single own_rows policy (which restricted every write to the requester) with explicit
  -- per-command policies: both parties may read; only the requester creates; only the recipient
  -- responds. A donor can no longer be blocked from accepting/declining their own incoming request.
  execute 'drop policy if exists own_rows on blood.match_requests';
  execute $p$create policy match_select on blood.match_requests for select to authenticated
    using (requester_user_id = checkout.current_app_user_id() or donor_user_id = checkout.current_app_user_id())$p$;
  execute $p$create policy match_insert on blood.match_requests for insert to authenticated
    with check (requester_user_id = checkout.current_app_user_id())$p$;
  execute $p$create policy match_respond on blood.match_requests for update to authenticated
    using (donor_user_id = checkout.current_app_user_id())
    with check (donor_user_id = checkout.current_app_user_id())$p$;
end;
$$;