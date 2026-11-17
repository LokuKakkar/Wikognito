# Security and abuse protection

Goal: a flood of requests, even from many addresses, must not take the site down and must not
create a bill. This page says what stops what, and what cannot be stopped from one small VM.

## Layers (outermost first)

| Layer | What it does | Where |
| --- | --- | --- |
| Oracle network | Absorbs most volumetric (L3/L4) floods before they reach the VM | Oracle |
| Oracle security list | Only 22, 80, 443 reach the VM | OCI console |
| Host firewall (optional, not deployed) | Caps simultaneous and new connections per source address on 80/443; skipped because Caddy limits and timeouts cover it and it can drop real users sharing an IP | `infrastructure/host/firewall.sh` |
| Caddy | Per-IP request-rate limits for the whole site (frontend included), body size cap, slow-client timeouts | `infrastructure/docker/Caddyfile` |
| Backend | Per-IP, per-route limits in Redis; new-session throttle; scrypt concurrency cap; 64 KB body limit | `apps/backend/src` |
| Containers | CPU, memory and process ceilings so a flood cannot starve SSH or the host | `docker-compose.prod.yml` |
| Cost guard | Stops Caddy if this month's outbound traffic nears the free allowance | `infrastructure/host/egress-guard.sh` |
| Oracle quotas and budget | Make it impossible to create paid resources, and alert on any spend | OCI console |

## Rules the code relies on

- The rate-limit key is the client address plus the route bucket. It must never be derived from a
  cookie or header the client controls.
- Caddy is the only hop in front of the backend (`trustProxy: 1`). Never publish port 4000.
- Anything that writes to Postgres on behalf of an anonymous visitor must be throttled and have a
  cleanup job (see `session-cleanup.ts`).
- Public endpoints must not do unbounded work: cap array sizes and string lengths in the shared
  zod schemas.

## Real-user capacity

Limits are per client IP per minute and sized so a crowd of real players never trips them, even
many sharing one address (campus, office, mobile-carrier NAT). One player's home page load is
about 4 API calls and ~40 asset requests, and each guess syncs once.

| Limit (per IP) | Value | Roughly allows |
| --- | --- | --- |
| Caddy, whole site | 3000/min | 75+ page loads a minute from one address |
| Caddy and backend, API | 1200/min and 600/min | dozens of players behind one address |
| Game sync / complete | 300/min | several players guessing quickly from one address |
| Login / register / reset | 30/min | the tightest; scrypt is CPU heavy |
| New anonymous sessions | 600 per 10 min | a campus-sized burst of first visits |
| Connections (firewall) | 200 open, 50 new/s | browsers open a few each |

Distinct addresses are not limited against each other, so 100 or 1000 simultaneous real users on
different IPs never interact. The CPU for that load is small (the daily puzzle is cached). If a real
crowd ever hits a limit, raise the matching `RATE_LIMIT_*` value in `.env.prod` (Caddy and firewall
values live in their files). A single abusive address still gets cut off within seconds.

## Honest limits

A single 2-OCPU VM cannot out-last a large volumetric attack by itself. These layers make each
request cheap to refuse and keep the damage to downtime, never to cost: the kill-switch turns the
public site off rather than let outbound traffic run up charges. The real fix for large attacks is
a CDN in front (Cloudflare free plan), which needs a domain whose DNS Cloudflare controls. A
`duckdns.org` name cannot do that.

## Verifying

- `curl -s -o /dev/null -w '%{http_code}\n' https://wikognito.duckdns.org/health` is 200.
- 30 rapid `POST /api/auth/login` requests from one machine end in 429s.
- `docker compose ... logs caddy` shows real visitor addresses, not a Docker gateway address.
