#!/usr/bin/env bash
#
# apply-migration.sh — apply Supabase SQL from a developer terminal.
#
# Credentials come from the git-ignored server/gateway/.env (DATABASE_URL). Render never applies
# migrations (distroless image); see docs/RUNBOOKS/DATABASE_MIGRATIONS.md.
#
# Usage:
#   server/supabase/apply-migration.sh <file.sql> [more.sql ...]   # apply explicit files, in order
#   server/supabase/apply-migration.sh --from 0046 [--seed]        # apply migrations >= 0046
#   server/supabase/apply-migration.sh --all [--seed]              # fresh DB: all migrations (+seed)
#
# Uses local `psql` when available, otherwise a throwaway `postgres:16` Docker container (the
# connection string is passed by env, never on the host command line).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATIONS_DIR="$SCRIPT_DIR/migrations"
SEED_FILE="$SCRIPT_DIR/seed/0001_seed.sql"
ENV_FILE="$ROOT/server/gateway/.env"

usage() {
  sed -n '2,14p' "${BASH_SOURCE[0]}" | sed -E 's/^# ?//'
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "error: $ENV_FILE not found (needed for DATABASE_URL)" >&2
  exit 1
fi

# Read just DATABASE_URL (avoids sourcing unrelated values / JSON secrets).
DATABASE_URL="$(grep -E '^DATABASE_URL=' "$ENV_FILE" | tail -n 1 | cut -d= -f2- | sed -E "s/^[\"'](.*)[\"']$/\1/")"
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "error: DATABASE_URL is not set in $ENV_FILE" >&2
  exit 1
fi
export DATABASE_URL

if command -v psql >/dev/null 2>&1; then
  RUNNER="psql"
elif command -v docker >/dev/null 2>&1; then
  RUNNER="docker"
else
  echo "error: neither 'psql' nor 'docker' is available to apply SQL" >&2
  echo "       install postgresql-client (psql) or Docker, then retry" >&2
  exit 1
fi

apply_file() {
  local file="$1"
  [[ -f "$file" ]] || {
    echo "error: no such file: $file" >&2
    exit 1
  }
  echo "→ applying ${file#"$ROOT"/}"
  if [[ "$RUNNER" == "psql" ]]; then
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$file"
  else
    docker run --rm -i --env DATABASE_URL postgres:16 \
      sh -c 'psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f -' <"$file"
  fi
}

FILES=()
DO_ALL=0
DO_SEED=0
FROM=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --all) DO_ALL=1; shift ;;
    --seed) DO_SEED=1; shift ;;
    --from)
      FROM="${2:-}"
      [[ -n "$FROM" ]] || { echo "error: --from needs a migration number (e.g. 0046)" >&2; exit 1; }
      shift 2
      ;;
    --*)
      echo "error: unknown option $1" >&2
      usage
      exit 1
      ;;
    *)
      FILES+=("$1")
      shift
      ;;
  esac
done

if [[ $DO_ALL -eq 1 ]]; then
  mapfile -t FILES < <(find "$MIGRATIONS_DIR" -maxdepth 1 -name '*.sql' | sort)
elif [[ -n "$FROM" ]]; then
  mapfile -t FILES < <(
    find "$MIGRATIONS_DIR" -maxdepth 1 -name '*.sql' | sort |
      awk -F/ -v from="$FROM" '{ n = $NF; if (n + 0 >= from + 0) print }'
  )
elif [[ ${#FILES[@]} -eq 0 ]]; then
  echo "error: nothing to apply (pass a file, --from NNNN, or --all)" >&2
  usage
  exit 1
fi

if [[ $DO_SEED -eq 1 ]]; then
  FILES+=("$SEED_FILE")
fi

for f in "${FILES[@]}"; do
  apply_file "$f"
done

echo "✓ applied ${#FILES[@]} file(s)"