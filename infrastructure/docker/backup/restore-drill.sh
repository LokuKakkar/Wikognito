#!/usr/bin/env bash
# Restore a dump into a throwaway Postgres container and print row counts.
# A backup that has never been restored is not a backup: run this after setting backups up
# and then roughly once a quarter.
#
#   ./restore-drill.sh /srv/wikognito/backups/wikognito-20261029T020000Z.dump
set -euo pipefail

dump="${1:?usage: restore-drill.sh <dump-file>}"
name="wikognito-restore-drill-$$"
trap 'docker rm -f "$name" >/dev/null 2>&1 || true' EXIT

docker run -d --name "$name" -e POSTGRES_PASSWORD=drill postgres:16-alpine >/dev/null
until docker exec "$name" pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
sleep 2
docker exec "$name" createdb -U postgres drill
docker exec -i "$name" pg_restore -U postgres -d drill --no-owner <"$dump"

docker exec "$name" psql -U postgres -d drill -At -c \
  "select 'Article', count(*) from \"Article\" union all
   select 'Puzzle', count(*) from \"Puzzle\" union all
   select 'DailyPuzzle', count(*) from \"DailyPuzzle\" union all
   select 'User', count(*) from \"User\" union all
   select 'GameResult', count(*) from \"GameResult\""
echo "restore drill OK"
