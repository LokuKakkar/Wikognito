#!/usr/bin/env bash
# Cost kill-switch. Oracle's Always Free outbound allowance is 10 TB/month; beyond that a Pay As
# You Go account is billed. This stops the public web containers once this month's outbound
# traffic passes LIMIT_GB, long before 10 TB, and starts them again when a new month begins.
# Needs vnstat (apt install vnstat). Run every 10 minutes from the systemd timer.
set -euo pipefail

LIMIT_GB="${LIMIT_GB:-5000}"
COMPOSE_DIR="${COMPOSE_DIR:-/home/ubuntu/Wikognito}"
STATE=/var/lib/wikognito-egress-guard.tripped
COMPOSE=(docker compose --env-file "$COMPOSE_DIR/.env.prod" -f "$COMPOSE_DIR/infrastructure/docker/docker-compose.prod.yml")

# The interface that carries public traffic (never a Docker bridge or loopback).
IFACE=$(ip route show default | awk '{print $5; exit}')
# vnstat reports bytes; "tx" of the current month on that interface.
tx_bytes=$(vnstat --json m -i "$IFACE" 2>/dev/null | python3 -c '
import json, sys
data = json.load(sys.stdin)
months = data["interfaces"][0]["traffic"]["month"] if data["interfaces"] else []
print(months[-1]["tx"] if months else 0)
')
tx_gb=$(( tx_bytes / 1000000000 ))
this_month=$(date -u +%Y-%m)

if [ "$tx_gb" -ge "$LIMIT_GB" ]; then
  if [ ! -f "$STATE" ] || [ "$(cat "$STATE")" != "$this_month" ]; then
    echo "$this_month" > "$STATE"
    logger -t wikognito-egress-guard "outbound ${tx_gb} GB >= ${LIMIT_GB} GB: stopping caddy"
    "${COMPOSE[@]}" stop caddy
  fi
elif [ -f "$STATE" ] && [ "$(cat "$STATE")" != "$this_month" ]; then
  rm -f "$STATE"
  logger -t wikognito-egress-guard "new month, ${tx_gb} GB used: starting caddy"
  "${COMPOSE[@]}" start caddy
fi
