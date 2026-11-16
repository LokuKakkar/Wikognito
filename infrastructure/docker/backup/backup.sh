#!/usr/bin/env bash
# Nightly Postgres backup: pg_dump (custom format) -> local dir -> optional OCI Object Storage.
#
#   BACKUP_DIR=/srv/wikognito/backups RCLONE_REMOTE=oci:wikognito-backups ./backup.sh
#
# BACKUP_DIR        local dump directory (default ./backups)
# KEEP_DAYS         local retention in days (default 7)
# RCLONE_REMOTE     optional rclone destination, e.g. oci:wikognito-backups (S3-compatible
#                   remote configured with an OCI Customer Secret Key). Empty = local only.
# REMOTE_KEEP_DAYS  remote retention in days (default 30)
set -euo pipefail

cd "$(dirname "$0")/../../.."
ENV_FILE="${WIKOGNITO_ENV_FILE:-.env.prod}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP_DAYS="${KEEP_DAYS:-7}"
REMOTE_KEEP_DAYS="${REMOTE_KEEP_DAYS:-30}"

dc() {
  docker compose -f infrastructure/docker/docker-compose.prod.yml --env-file "$ENV_FILE" "$@"
}

mkdir -p "$BACKUP_DIR"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
out="$BACKUP_DIR/wikognito-$stamp.dump"

# -T: no TTY, so the dump streams cleanly to a file.
dc exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner' >"$out.partial"
mv "$out.partial" "$out"
echo "backup written: $out ($(du -h "$out" | cut -f1))"

if [ -n "${RCLONE_REMOTE:-}" ]; then
  rclone copy "$out" "$RCLONE_REMOTE"
  rclone delete "$RCLONE_REMOTE" --min-age "${REMOTE_KEEP_DAYS}d"
  echo "uploaded to $RCLONE_REMOTE"
else
  echo "RCLONE_REMOTE not set: local backup only (no off-box copy)" >&2
fi

find "$BACKUP_DIR" -name 'wikognito-*.dump' -mtime +"$KEEP_DAYS" -delete
