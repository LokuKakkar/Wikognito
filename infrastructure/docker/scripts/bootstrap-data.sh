#!/usr/bin/env bash
# First-run data load for an empty production database. Idempotent: safe to re-run.
#
#   infrastructure/docker/scripts/bootstrap-data.sh
#
# Needs the stack to be up (postgres + redis) and the host directories from
# ARTICLES_DIR (article snapshot JSON) and CORPUS_DIR (dossier definition JSON) filled in.
# Never runs `pnpm db:seed`: that creates public demo admin accounts.
set -euo pipefail

cd "$(dirname "$0")/../../.."
ENV_FILE="${WIKOGNITO_ENV_FILE:-.env.prod}"
dc() {
  docker compose -f infrastructure/docker/docker-compose.prod.yml --env-file "$ENV_FILE" "$@"
}
run() { dc run --rm --no-deps backend "$@"; }

echo "==> Restoring article snapshots (no Wikipedia calls)"
run pnpm articles:restore

echo "==> Generating and validating puzzles"
run pnpm puzzles:generate --all
run pnpm puzzles:validate

echo "==> Seeding dossiers (missing articles are imported from Wikipedia)"
shopt -s nullglob
for file in "${CORPUS_DIR:-./data/corpus}"/*.json; do
  name="$(basename "$file")"
  echo "--- $name"
  run pnpm dossiers:seed --file "/data/corpus/$name"
done

echo "==> Publishing today's puzzle"
run pnpm puzzles:publish-today

echo "Done."
