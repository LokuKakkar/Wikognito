#!/usr/bin/env bash
# Per-source-address connection limits for the public web ports, applied in Docker's
# DOCKER-USER chain (published container ports bypass the normal INPUT chain, so INPUT rules
# would never see this traffic). Idempotent: safe to run repeatedly. SSH (22) is not touched.
#
#   sudo bash infrastructure/host/firewall.sh          # apply
#   sudo bash infrastructure/host/firewall.sh remove   # take the limits off
set -euo pipefail

CHAIN="WIKOGNITO-LIMIT"
PORTS="80,443"
MAX_CONC=200         # simultaneous connections per source address
NEW_PER_SEC=50       # sustained new connections per second per source address
NEW_BURST=150

iptables -N DOCKER-USER 2>/dev/null || true

# Remove any previous copy so the script can be re-run.
while iptables -D DOCKER-USER -j "$CHAIN" 2>/dev/null; do :; done
iptables -F "$CHAIN" 2>/dev/null || true
iptables -X "$CHAIN" 2>/dev/null || true

if [ "${1:-}" = "remove" ]; then
  echo "wikognito firewall limits removed"
  exit 0
fi

iptables -N "$CHAIN"
# Match on the original (pre-DNAT) destination port: that is the port the visitor used.
for port in 80 443; do
  iptables -A "$CHAIN" -p tcp -m conntrack --ctstate NEW --ctorigdstport "$port" \
    -m connlimit --connlimit-above "$MAX_CONC" --connlimit-mask 32 -j DROP
  iptables -A "$CHAIN" -p tcp -m conntrack --ctstate NEW --ctorigdstport "$port" \
    -m hashlimit --hashlimit-name "wk-new-$port" --hashlimit-mode srcip \
    --hashlimit-above "${NEW_PER_SEC}/second" --hashlimit-burst "$NEW_BURST" -j DROP
done
iptables -A "$CHAIN" -j RETURN

iptables -I DOCKER-USER 1 -j "$CHAIN"
echo "wikognito firewall limits applied (ports $PORTS: ${MAX_CONC} conns, ${NEW_PER_SEC}/s per source)"
