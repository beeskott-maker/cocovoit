#!/usr/bin/env bash
# Applique les migrations Supabase sur une base Postgres vide puis lance les tests SQL.
# Usage : DATABASE_URL=postgres://... scripts/test-db.sh
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL doit être défini}"
cd "$(dirname "$0")/.."

# Rôles fournis par Supabase, à recréer sur un Postgres nu.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q <<'SQL'
do $$ begin
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
grant usage on schema public to anon, authenticated;
SQL

for f in supabase/migrations/*.sql; do
  echo "→ $f"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$f"
done

for f in supabase/tests/*.sql; do
  echo "→ $f"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$f"
done
