#!/bin/sh
# Runs once, on first boot of a fresh compose Postgres volume (mounted into
# /docker-entrypoint-initdb.d by docker-compose.yml).
#
# Why a wrapper instead of mounting each migration file: the migrations directory is mounted whole,
# so new migrations are picked up automatically (no per-file list to keep in sync), the seed runs
# after every migration, and ON_ERROR_STOP makes a bad statement fail the boot instead of being
# silently skipped.
set -eu

: "${POSTGRES_USER:?POSTGRES_USER must be set}"
: "${POSTGRES_DB:?POSTGRES_DB must be set}"

echo "compose-init: applying migrations from /migrations"
for f in /migrations/*.sql; do
  echo "compose-init: ${f}"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$f"
done

echo "compose-init: applying seed"
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /seed/0001_seed.sql
echo "compose-init: done"