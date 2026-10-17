-- Faazio MVP — media GC + delete purge signal (Phase 8).
-- Authority: docs/architecture/db-schema.md §12.16, caching-cloudflare-valkey.md §5/§8.
--
-- Why: 0025 emits `media_updated` on insert/update so the purge worker can invalidate a cached CDN URL
-- when an asset is confirmed/rejected. Deletes emit nothing, so a removed (or GC-reclaimed) asset kept
-- serving from the edge. This adds a DELETE trigger that carries the OLD row's key so the same worker
-- purges it. The GC sweeper itself needs no schema change — it scans DRAFT rows via the existing
-- `media_assets_status_idx (status, created_at desc)` from 0025.
--
-- Additive + idempotent (never rewrites 0025).

-- ================================================================ delete purge signal
-- Payload mirrors the insert/update shape plus "op":"DELETE"; `r2_key`/`kind` come from the removed row.
create or replace function media.notify_asset_delete()
returns trigger
language plpgsql
as $$
begin
  perform pg_notify('media_updated', json_build_object(
    'op', 'DELETE', 'id', old.id, 'status', old.status, 'r2_key', old.r2_key, 'kind', old.kind)::text);
  return old;
end;
$$;

drop trigger if exists media_asset_notify_delete on media.assets;
create trigger media_asset_notify_delete
  after delete on media.assets
  for each row execute function media.notify_asset_delete();