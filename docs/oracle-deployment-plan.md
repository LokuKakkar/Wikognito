# Wikognito → Oracle Cloud Always Free: full migration plan

Self-contained brief. It can be handed to another chat or engineer with no other context.

Status: **plan only**. Nothing in this document has been implemented or tested yet. Every code and config snippet is a **draft** to be validated locally.

Written 2026-10-28. Provider limits change. Items marked **VERIFY** came from third-party articles or from memory, not from a provider's own page that was checked at the time of writing.

---

## 1. Why this exists

Wikognito (a redacted-Wikipedia word game, internal package names `@redactle/*`) ran on Render's free tier for a 15-day test. The Render free Postgres expired and was **deleted**. There is **no database dump**. The goal is to host all four runtime parts on a platform that is free **forever**:

1. Frontend (Next.js)
2. Backend (Fastify API)
3. Redis
4. PostgreSQL

Chosen target: **one Oracle Cloud Always Free Arm VM** running everything in Docker Compose behind Caddy, on one free `wikognito.*` domain.

Requirements given by the owner:

- Any domain that contains the word `wikognito` is acceptable (free subdomain is fine).
- Adding Dockerfiles to the repo is fine.
- Outbound email is wanted **only if it is free**.
- All work happens on a **separate branch**, is **committed and tested locally first**, and is **merged to `main` only after that**.

---

## 2. The project in one page

Repo: `github.com/LokuKakkar/Wikognito` (branches `main`, `develop`; this work is on `deploy/oracle-always-free`, cut from `develop`. `develop` is ahead of `main`; `main` has nothing `develop` lacks).

pnpm monorepo, Node 20+ (CI uses 20, project developed on 22), pnpm 10.32.1.

| Path | What |
|---|---|
| `apps/frontend` | Next.js 15 App Router, React 19. A Node server (`next start`), **not** a static site. Port 3002 (or `$PORT`). |
| `apps/backend` | Fastify 5 + Prisma 6 + ioredis. Runs via `tsx src/server.ts` (workspace packages export `.ts`, so there is no compiled output; `build` is only a typecheck). Port `$PORT` or `$BACKEND_PORT` (default 4000). |
| `packages/shared`, `packages/puzzle-engine`, `packages/test-utils` | Shared types, game logic (runs in the browser too), test helpers. |
| `services/article-provider`, `services/article-ingestion` | Wikipedia import, puzzle generation, CLIs (`articles:restore`, `puzzles:generate`, `dossiers:seed`, ...). |
| `apps/backend/prisma` | Schema + 10 migrations + `seed.ts`. |
| `infrastructure/docker/docker-compose.yml` | **Local dev only**: Postgres 16 (host 5433) + Redis 7 (host 6380). |
| `data/wikipedia-articles/*.json` | 93 article snapshots, 21 MB, **gitignored**, exist on the owner's laptop. |
| `ops/bulk-corpus/*.json` | Dossier definitions (anime, countries, movies, marvel, sports, ...), **gitignored**, exist on the owner's laptop. |

Behavior that matters for hosting:

- Guessing is client-side. No API call per guess.
- `GET /api/puzzles/today` reads `DailyPuzzle`; if today has none, it publishes lazily. The API also publishes at startup and at 00:00 UTC (in-process scheduler). **No cron needed.**
- Redis holds: gameplay session blobs, Google OAuth state, today's puzzle cache, rate-limit counters. Losing Redis never loses official results. `/health/ready` is 503 only if Postgres is down.
- Postgres holds everything durable: users, articles (full text), puzzles, daily assignments, dossiers, game results, stats.
- `NODE_ENV=production` makes the backend: refuse a localhost `FRONTEND_ORIGIN`, trust the proxy for client IPs (`trustProxy`), set `Secure` cookies, use a strict CORS allowlist (`FRONTEND_ORIGIN` only), sanitize 500s.
- `NEXT_PUBLIC_API_BASE_URL` is **inlined at frontend build time**, including into the CSP `connect-src`. Changing it needs a rebuild.

Existing docs worth reading in the repo: `README.md`, `DEVELOPMENT.md`, `docs/what-is-built.md`, `docs/architecture/overview.md`, `docs/deployment.md` (Render-specific, will need a rewrite), `docs/environment.md`, `docs/operations.md`, `docs/article-backups.md`, `docs/api/README.md`.

---

## 3. What Oracle gives us (from the owner's pasted Always Free list)

Used by this plan:

| Resource | Allowance | How we use it |
|---|---|---|
| Arm Ampere A1 compute | "Arm-based Ampere A1 cores and 12 GB of memory usable as 1 VM or 2 VMs"; **1,500 OCPU-hours and 9,000 GB-hours per month** | One VM: **2 OCPU / 12 GB** (1,500 OCPU-h ≈ 2 OCPU × 744 h; 9,000 GB-h ≈ 12 GB × 744 h). Do not create a second A1 VM. |
| Block/boot volume | 2 volumes, 200 GB total, plus 5 volume backups | One boot volume 50–100 GB. Postgres data lives on it. |
| Outbound data | up to 10 TB / month | Not a constraint. |
| VCN | 2 VCNs, IPv4+IPv6 | One VCN with a public subnet. |
| Object Storage | 20 GB total, 50,000 API requests/month | Off-box **database backups**. |
| Email Delivery | up to 100 emails/day | Candidate for password-reset mail, but see section 9 (needs a domain you control for proper authentication). |
| Notifications / Monitoring | 1,000 emails/month via Notifications; monitoring metrics | Optional alerts (uptime, disk). |
| Bastion | up to 5 | Optional alternative to open SSH. |

Not used: AMD micro VMs (2 × 1/8 OCPU, 1 GB; too small, optional as a monitoring box), Load Balancer / Network LB (Caddy does this), Autonomous DB / HeatWave / NoSQL (the app is Prisma+Postgres and the free versions are different engines), APEX, Vault (optional for secrets).

Caveats, all **VERIFY** on Oracle's own pages / console:

- Third-party blogs reported the A1 allowance was reduced from 4 OCPU / 24 GB to 2 OCPU / 12 GB. The owner's pasted list shows 12 GB, which is consistent. Size everything for **12 GB**.
- **Idle reclamation:** Oracle docs say idle Always Free compute may be reclaimed. Idle = over 7 days, 95th-percentile CPU < 20%, network < 20%, memory < 20% (the memory condition applies to A1). **This app will look idle.** Mitigation is in section 8 (upgrade the account to Pay As You Go; Always Free resources stay free). **VERIFY** current reclamation wording and whether PAYG accounts are exempt.
- **Capacity:** A1 often returns "Out of host capacity" at creation time. See section 8.
- **Credit card:** a card is very likely required for sign-up identity verification. **VERIFY** in the sign-up flow. Not charged if you stay within Always Free.
- **Home region is permanent.** Always Free A1 can only be created in the home region chosen at sign-up. Pick a region close to the players and known for A1 availability.
- **Outbound SMTP:** OCI blocks port 25 by default; submission ports (587) are normally open. **VERIFY** before relying on it.

---

## 4. Target architecture

```text
                Internet
                   │  80/443 only
            ┌──────▼───────┐
            │    Caddy     │  automatic Let's Encrypt, one origin
            └──┬────────┬──┘
   /api/*      │        │   everything else
   /health*    │        │
        ┌──────▼──┐  ┌──▼────────┐
        │ backend │  │ frontend  │   Docker network "internal"
        │ :4000   │  │ :3002     │   no ports published except Caddy
        └───┬───┬─┘  └───────────┘
            │   │
     ┌──────▼┐ ┌▼───────┐        ┌──────────────────┐
     │ pg 16 │ │ redis 7│        │ backup job → OCI │
     └───────┘ └────────┘        │ Object Storage   │
                                 └──────────────────┘
```

All on **one A1 VM**, Ubuntu 24.04 aarch64.

### Same-origin routing (the key design choice)

Caddy serves `https://wikognito.duckdns.org` (name to be confirmed) and routes:

- `/api/*`, `/health`, `/health/ready` → `backend:4000`
- everything else → `frontend:3002`

The browser only ever talks to one origin. Consequences:

- `NEXT_PUBLIC_API_BASE_URL = https://wikognito.duckdns.org` (same origin as the page; **not** a separate API host).
- `FRONTEND_ORIGIN = https://wikognito.duckdns.org` (identical string, no trailing slash).
- The session cookie becomes **first-party**. The current production code forces `SameSite=None; Secure` (`apps/backend/src/app.ts`, in `ensureSessionId`, added in commit `caf7ad5` because Render's two hosts were cross-site). With one origin we can use `SameSite=Lax`, which survives Safari ITP and Chrome third-party-cookie blocking. See code task C5.
- CORS becomes irrelevant for the browser (same origin) but stays configured and correct.
- Google redirect URI is on the same host: `https://wikognito.duckdns.org/api/auth/google/callback`.

### Why not expose backend and frontend on separate hostnames

DuckDNS gives one free name per subdomain. Two subdomains (`wikognito.duckdns.org`, `wikognito-api.duckdns.org`) work technically, but duckdns.org is on the Public Suffix List, so they are **cross-site** and we would be back to `SameSite=None` third-party-cookie fragility. One origin is simpler and more robust.

---

## 5. Git and release rules (non-negotiable for this task)

1. All work is on branch **`deploy/oracle-always-free`**. Never commit this work to `main` or `develop` directly.
2. Order: **code on branch → commit → test locally (section 11) → only then merge.**
3. Merge path: the repo previously used PRs `develop` → `main` (PR #1). Decide at merge time whether to merge this branch into `develop` and then `develop` → `main`, or open a PR straight to `main`. Either way, **ask the owner before merging or pushing**.
4. Recommended extra gate (needs owner approval to push the branch): deploy the branch to the Oracle VM and run the section 11 checklist there before merging, because the VM is **arm64** and the laptop is probably **amd64**. Local tests cannot prove arm64 image builds.
5. Commit hygiene: small, reviewable commits (Dockerfiles; compose+Caddy; cookie/mailer code; backup scripts; docs). No secrets, no `.env`, no article JSON, no `ops/bulk-corpus` in git (all are gitignored; keep it that way).
6. CI (`.github/workflows/ci.yml`) must stay green: lint, typecheck, tests, build.

---

## 6. Decisions already made

| Decision | Choice |
|---|---|
| Hosting | Oracle Always Free A1 VM, 2 OCPU / 12 GB, Ubuntu 24.04 aarch64 |
| Packaging | Docker Compose, Dockerfiles added to repo |
| Postgres / Redis | Containers on the same VM (self-managed), not managed |
| Reverse proxy / TLS | Caddy with automatic Let's Encrypt |
| Domain | Free DuckDNS subdomain containing "wikognito" (default `wikognito.duckdns.org`; confirm it is free) |
| Origin model | Single origin, path-routed |
| Daily publish | Unchanged (in-process scheduler + lazy publish). No cron. |
| Dummy seed (`pnpm db:seed`) | **Never run in production** (see section 12, gotcha 1) |
| Email | Optional. Decide in section 9. Free options only. |
| Data restore | Rebuild from the owner's 93 article snapshots + dossier JSON files (no DB dump exists) |

---

## 7. Code and repo changes (agent work, on the branch)

Each item: what, where, why. IDs are used in the checklist at the end.

### C1. Dockerfile (multi-stage, two targets)

File: `Dockerfile` at repo root (or `infrastructure/docker/Dockerfile`; root is simpler because the whole workspace is the build context).

- Base `node:22-bookworm-slim` (multi-arch, so the same file builds for amd64 and arm64).
- `apt-get install -y --no-install-recommends openssl ca-certificates` (Prisma needs OpenSSL; slim images lack it).
- `corepack enable` and pin `pnpm@10.32.1` (matches `packageManager`).
- Stage `deps`: copy `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` and **every workspace `package.json`** first, then `pnpm install --frozen-lockfile` (cache-friendly). **Do not use `--prod`**: backend runs through `tsx` and migrations need the Prisma CLI, both devDependencies.
- Stage `source`: copy the rest. `postinstall` in `@redactle/backend` runs `prisma generate`; confirm the generated client exists for `linux-arm64-openssl-3.0.x` when built on arm64 (it is generated inside the image, so it matches the image's platform).
- Target `backend`: `CMD ["pnpm","--filter","@redactle/backend","start"]`, `EXPOSE 4000`, runs as the non-root `node` user, `HEALTHCHECK` on `/health`.
- Target `frontend`: `ARG NEXT_PUBLIC_API_BASE_URL` and `ARG NEXT_PUBLIC_ILLUSTRATIONS_PACK=none` → `ENV`, then `pnpm --filter @redactle/frontend... build`. `CMD ["pnpm","--filter","@redactle/frontend","start"]`, `EXPOSE 3002`.
- Keep the backend image's contents sufficient to run the **operator CLIs** (`articles:restore`, `puzzles:generate`, `puzzles:validate`, `dossiers:seed`, `corpus:process`): these live in `services/article-ingestion` and are invoked from the root `package.json` scripts, so the backend image must contain the full workspace and root `package.json`.
- `.dockerignore`: `node_modules`, `.next`, `.git`, `.env`, `.env.*`, `data/`, `ops/`, `wikognito-images/`, `coverage`, `docs/`, logs. (Secrets and the 21 MB snapshots must never enter an image.)
- Image size is not a concern. Build memory on a 12 GB VM is fine for `next build`.
- Note: `next.config.ts` reads `../../.env` if present. In the image there is no `.env`, so build args are the only source. This is intended.
- Optional later: Next `output: "standalone"` to shrink the frontend image. Not needed now; monorepo standalone tracing adds risk.

### C2. Production compose file

File: `infrastructure/docker/docker-compose.prod.yml` (leave the existing dev `docker-compose.yml` untouched; `pnpm infra:up` depends on it).

Services:

- `caddy` (`caddy:2`): only service with published ports `80:80`, `443:443` (and `443:443/udp` for HTTP/3, optional). Volumes for `/data` and `/config` (certificate storage must persist or Let's Encrypt rate limits bite).
- `frontend`: build target `frontend`, build arg from `.env.prod`, `restart: unless-stopped`, no published ports.
- `backend`: build target `backend`, `env_file`, `restart: unless-stopped`, no published ports, `depends_on: migrate (service_completed_successfully), postgres (healthy), redis (healthy)`.
- `migrate`: same image as backend, `command: pnpm db:migrate:deploy`, `restart: "no"`. Replaces Render's "pre-deploy command". Runs `prisma migrate deploy` only, never `migrate dev` / `db push`.
- `postgres` (`postgres:16-alpine`): volume on the VM's disk (named volume or bind mount like `/srv/wikognito/pgdata`), healthcheck `pg_isready`, **no published port**, memory limit, sensible tuning for a 12 GB host (e.g. `shared_buffers=512MB`, `effective_cache_size=2GB`, `max_connections=50`); Prisma's default pool is small, so the app does not need many connections.
- `redis` (`redis:7-alpine`): `--maxmemory 128mb --maxmemory-policy allkeys-lru`, optional `--save 300 10` so sessions survive a restart, volume, healthcheck, **no published port**. Optionally `--requirepass` with the password inside `REDIS_URL` (`redis://:PASSWORD@redis:6379`), cheap defense in depth.
- `backup`: small job/container (or host systemd timer, see C6) that runs `pg_dump` and uploads to Object Storage.
- Compose-level: a named `internal` network; log rotation (`logging: driver json-file, max-size 10m, max-file 3`); `mem_limit` on each container so a runaway process cannot take the host down.

### C3. Caddyfile

File: `infrastructure/docker/Caddyfile`.

```caddy
{$SITE_ADDRESS} {
    encode zstd gzip

    @backend path /api/* /health /health/ready
    handle @backend {
        reverse_proxy backend:4000
    }
    handle {
        reverse_proxy frontend:3002
    }
}
```

- `SITE_ADDRESS` is `wikognito.duckdns.org` on the VM and `wikognito.localtest.me` locally (with `tls internal`, see section 11).
- Caddy sets `X-Forwarded-For`/`-Proto`/`-Host` to the real client; the backend has `trustProxy: true` in production, so rate limits key on the real client IP. **This is only safe if the backend is not reachable except through Caddy** (no published port for it).
- Next.js already sets its own security headers (CSP, HSTS, etc.). Do not duplicate HSTS in Caddy.

### C4. Production env template

File: `.env.production.example` (names only; no secrets). The real `.env.prod` lives only on the VM, mode `600`, never in git (already covered by `.gitignore`: `.env.*`, with `!.env.example` only; **add `!.env.production.example`** to `.gitignore`).

See the env matrix in section 10.

### C5. Cookie `SameSite` becomes configurable

File: `apps/backend/src/app.ts` (`ensureSessionId`, currently `sameSite: config.NODE_ENV === "production" ? "none" : "lax"`).

- Add env `SESSION_COOKIE_SAMESITE` (`lax` | `none` | `strict`, validated in `apps/backend/src/infrastructure/config/env.ts`).
- Default: keep today's behavior (`none` in production, `lax` otherwise) so the existing Render-style split deployment is not broken. On the Oracle deployment set it to **`lax`**.
- `none` requires `Secure`; keep `secure: NODE_ENV === "production"`.
- Add/adjust a test in `apps/backend/src/app.test.ts` for the cookie attributes.
- Update `docs/deployment.md`, which currently claims `SameSite=Lax` while the code uses `none` (docs and code have drifted).
- Check there is no logout path that clears the cookie with different attributes (a grep found only one `setCookie`; logout clears `userId` server-side, not the cookie).

### C6. Backups (Postgres is now self-managed)

Files: `infrastructure/docker/backup/backup.sh`, restore script, systemd timer or cron unit, docs.

- Nightly `pg_dump --format=custom` (or `pg_dumpall` not needed; one DB), compressed, named with a UTC timestamp.
- Upload to an OCI Object Storage bucket (20 GB free, 50,000 requests/month, far above need). Two ways to authenticate: S3-compatible API with a **Customer Secret Key** + `rclone`/`aws cli`, or the OCI CLI with **instance principal** (dynamic group + policy; no secret on disk). Prefer instance principal if the owner is comfortable with IAM policy; otherwise Customer Secret Key.
- Retention: keep e.g. 7 daily + 4 weekly; delete older (Object Storage lifecycle rule or script).
- A **restore drill is part of "done"**: restore the latest dump into a scratch Postgres container and run a row-count check. A backup that has never been restored is not a backup.
- Also keep a copy of the dump **off Oracle** occasionally (the owner's laptop or another free store), because Oracle can terminate accounts.

### C7. Mailer: configurable sender (only if email is enabled)

File: `apps/backend/src/modules/auth/mailer.ts`.

- `SmtpMailer` hard-codes `from: "wikognito@localhost"`. That will be rejected or spam-foldered by every real provider. Add env `SMTP_FROM` (e.g. `Wikognito <no-reply@...>`), pass it in `createMailer`, wire it from config in `apps/backend/src/app.ts` where `createMailer(config.SMTP_URL)` is called, add it to `env.ts` and `.env.example`.
- `nodemailer.createTransport(smtpUrl)` already supports `smtp://user:pass@host:587` (STARTTLS) and `smtps://...:465`. Special characters in username/password must be **URL-encoded** in `SMTP_URL`.
- Email is only used for password reset now (email verification was removed in commit `e97fd96`). With `SMTP_URL` empty, mail goes to the container logs, which is acceptable as a fallback.
- Add a unit test with `CapturingMailer`/mocked transport for the `from` value.

### C8. Operator scripts for first-run data

Files: `infrastructure/docker/scripts/bootstrap-data.sh` (documented, idempotent), plus docs.

Sequence (runs through `docker compose run --rm backend ...` with the data directories mounted):

1. `pnpm articles:restore` (reads `ARTICLE_BACKUP_DIR`, idempotent on `externalId`, no Wikipedia calls).
2. `pnpm puzzles:generate -- --all` then `pnpm puzzles:validate`.
3. `pnpm dossiers:seed -- --file <json>` for each file in `ops/bulk-corpus/` (these import any missing article from Wikipedia: needs `WIKIPEDIA_USER_AGENT` and outbound HTTPS; keep `WIKIPEDIA_REQUEST_DELAY_MS`).
4. `pnpm puzzles:publish-today` (or just let the API do it).
5. Publish dossiers (draft vs published is controlled by the JSON `status`, or via `/admin/dossiers`).

`ARTICLE_BACKUP_DIR` should point at a mounted host directory (e.g. `/srv/wikognito/articles`), and the snapshot JSONs must be copied there by the owner (section 8, step 13).

### C9. Documentation updates (last, after it works)

- Rewrite `docs/deployment.md` for Oracle (keep a short "legacy Render" appendix or delete).
- Update `docs/what-is-built.md` ("Where it runs"), `docs/architecture/overview.md` intro, `docs/environment.md` (new vars), `docs/operations.md` (backup/restore, updating the VM), `docs/troubleshooting.md`, `docs/article-backups.md` ("Use when going live").
- `README.md` stays product-only.
- Remove stale Render references (`wikognito.onrender.com` URLs in `docs/` and `ops/bulk-corpus/import-prod.py` defaults, which is gitignored but should be updated locally).

### C10. Optional / nice to have (not blockers)

- CI job that builds both Docker targets (and `--platform linux/arm64` via QEMU) so image breakage is caught before deploy.
- `docker compose` convenience scripts in root `package.json` (`prod:up`, `prod:logs`).
- Small `/health` hook for external uptime checks (already exists).

### What does NOT need code changes

- Daily publish scheduler (no cron needed).
- Redis client (`REDIS_URL` accepts `redis://` with password).
- Rate limiter (uses `trustProxy`; keep `NODE_ENV=production`).
- Prisma schema and migrations (apply as-is on an empty DB).
- Frontend rewrites: `/api/:path*` → backend is already a safety net; with the same-origin setup it will not normally be hit.

---

## 8. Tasks only the owner can do (outside the repo)

Do these in order. Values in `<angle brackets>` are placeholders. Never paste secrets into git or into chat.

### Oracle Cloud

1. **Sign up** at Oracle Cloud (Always Free). Needs email, phone, and very likely a credit/debit card for verification (**VERIFY**). Choose the **home region** deliberately: it cannot be changed, and Always Free A1 can only be created there. Prefer a region near your players that has A1 capacity.
2. **Create a budget alert** (Billing → Budgets) at about $1, so an accidental paid resource emails you.
3. **Create a VCN** with the "VCN with Internet Connectivity" wizard (public subnet + internet gateway).
4. **Security list / NSG ingress rules** on the public subnet: TCP 80 and 443 from `0.0.0.0/0`; TCP 22 **only from your own IP** (or use the Bastion service instead of open SSH). Do **not** open 5432, 6379, 4000 or 3002.
5. **Create the VM**: Compute → Instances → shape **VM.Standard.A1.Flex**, **2 OCPU / 12 GB**, image **Ubuntu 24.04 (aarch64)**, boot volume 50–100 GB (you have 200 GB total free), assign a public IPv4, add your SSH public key. Do not exceed 2 OCPU/12 GB total across all A1 instances or you may be billed.
   - If you get **"Out of host capacity"**: retry later (capacity fluctuates), try another availability domain in your region, or use a retry loop with the OCI CLI. Upgrading to Pay As You Go commonly improves capacity (see step 7).
6. **Make the public IP stable.** An ephemeral IP survives reboots but is lost if the instance is terminated. Prefer a **reserved public IP** attached to the VM (**VERIFY** that a reserved IP attached to a running instance stays free).
7. **Avoid idle reclamation.** The app will sit below the 20% thresholds. Recommended: **upgrade the account to Pay As You Go** (Billing → Upgrade). You still pay nothing while using only Always Free resources, the budget alert protects you, and PAYG accounts are reported not to be reclaimed (**VERIFY**). If you refuse to upgrade, accept that the VM may be reclaimed; the backups in step 11 are your recovery path. (Artificially burning CPU to dodge the rule is fragile and not recommended.)
8. **Host firewall.** Oracle's Ubuntu images ship with `iptables` rules that reject everything except SSH, so the cloud security list alone is **not enough**. On the VM allow 80 and 443 before the REJECT rule and persist them (`iptables -I INPUT 5 -p tcp --dport 80 -j ACCEPT`, same for 443, then `netfilter-persistent save`). Check the rule position with `iptables -L INPUT -n --line-numbers`.
9. **Install on the VM:** Docker Engine + compose plugin (official Docker apt repo, arm64), git, `fail2ban` (optional), `unattended-upgrades`. Add your user to the `docker` group. Add 2–4 GB swap as a safety net for `next build`.
10. **Clone the repo** on the VM (HTTPS clone of the public repo is fine; if private, add a read-only deploy key).
11. **Backups:** create an Object Storage bucket (private, e.g. `wikognito-backups`) in the home region; create either a Customer Secret Key (store it only in the VM's root-readable config) or a dynamic group + IAM policy for instance-principal access; install the chosen tool; test an upload.
12. **Domain:** go to duckdns.org, sign in, create the subdomain (default `wikognito`), set its IP to the VM's public IP, and save the **token** (secret). Because the IP is static, there is no need for a dynamic-update cron beyond setting it once.
13. **Copy data to the VM** (from your laptop, which holds the files that are not in git):
    - `scp -r data/wikipedia-articles/ <user>@<vm-ip>:/srv/wikognito/articles/` (93 files, 21 MB)
    - `scp -r ops/bulk-corpus/*.json <user>@<vm-ip>:/srv/wikognito/corpus/` (dossier definitions; the `.py` and `README.txt` there are not needed)
14. **Create `/srv/wikognito/.env.prod`** (mode `600`) from `.env.production.example` with real values (section 10). Generate secrets with e.g. `openssl rand -hex 32`.

### Google Cloud Console (sign-in with Google)

15. On the existing OAuth **Web client**: add Authorized JavaScript origin `https://wikognito.duckdns.org` and Authorized redirect URI `https://wikognito.duckdns.org/api/auth/google/callback`. Keep `http://localhost:4000/api/auth/google/callback` for local use. Old `onrender.com` entries can be removed after cutover.
16. Put `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and the **same** redirect URI into `.env.prod`. The redirect URI must match character for character.
17. **VERIFY** that Google accepts a `duckdns.org` redirect for this client. It accepted `onrender.com` (also a shared suffix), so it likely works. If the consent screen is in "Testing", only listed test users can sign in; add yourself and anyone else, or publish the consent screen (basic scopes need no review, but check Google's current rules for authorized domains).
18. Set `GOOGLE_ADMIN_EMAILS` to your Google email(s). That account receives `ADMIN` on every login and is how you reach `/admin/*` (there is no seeded admin in production, see gotcha 1).

### Wikipedia

19. Choose a real `WIKIPEDIA_USER_AGENT`, e.g. `Wikognito/1.0 (https://wikognito.duckdns.org; you@example.com)`. Wikimedia rejects generic UAs. It is only needed for the dossier seeding step that imports missing articles, and for later admin imports.

### Email (optional, free only) — see section 9

20. If you want password-reset mail: sign up for the chosen free SMTP provider, verify a sender, and put `SMTP_URL` and `SMTP_FROM` in `.env.prod`.

### Ongoing (after launch)

21. Free uptime monitor (e.g. any free pinger) hitting `https://<domain>/health/ready`. Note this does **not** prevent idle reclamation.
22. Calendar reminder to run the **restore drill** once a quarter.
23. Delete the dead Render services and, if you like, the old GitHub-linked Render project, so nothing confusing remains.

---

## 9. Email decision

Only **password reset** needs outbound mail now (email verification was removed). With `SMTP_URL` empty the message is logged to the backend container logs, which works but forces you to dig reset links out of logs. Treat mail as optional.

| Option | Free | Works with a free DuckDNS name? | Notes |
|---|---|---|---|
| Leave empty (log only) | yes | yes | Zero setup. Reset links must be copied from `docker compose logs backend`. Fine for a hobby site. |
| **Brevo SMTP** (300/day) | yes | **yes**, using single-sender verification of an address you own (even a Gmail address) | Host `smtp-relay.brevo.com`, port 587 STARTTLS. Account approval is required before sending. Free-plan footer. Without domain authentication, deliverability is mediocre. Probably the best free choice here. **VERIFY** current limits. |
| **OCI Email Delivery** (100/day) | yes | **poorly** | Needs an Email Domain plus SPF/DKIM DNS records on a domain you control. DuckDNS does not offer arbitrary CNAME/TXT records for DKIM, so authentication is not achievable on a DuckDNS name; mail would likely be rejected or spam-foldered. Becomes viable if you later own a real domain. |
| Gmail SMTP with an app password | yes | yes | Works for tiny volume; ties the site to a personal account; against the spirit of a service; use only as a stopgap. |

Recommendation: ship v1 with **log-only**, add Brevo later if password reset is actually requested. The code change C7 (configurable `SMTP_FROM`) is cheap and worth doing either way.

SMTP URL format for nodemailer (URL-encode special characters in credentials):

```text
smtp://<login>:<smtp-key>@smtp-relay.brevo.com:587
```

---

## 10. Environment variable matrix (production on the VM)

Backend (`.env.prod`, secret file, mode 600):

| Variable | Secret | Value / source |
|---|---|---|
| `NODE_ENV` | no | `production` |
| `DATABASE_URL` | yes | `postgresql://wikognito:<db-password>@postgres:5432/wikognito` (service name `postgres`, internal network) |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | yes | Used by the postgres container; must match `DATABASE_URL` |
| `REDIS_URL` | yes | `redis://redis:6379` or `redis://:<pw>@redis:6379` |
| `FRONTEND_ORIGIN` | no | `https://wikognito.duckdns.org` (no trailing slash; must not be localhost in production) |
| `SESSION_COOKIE_SAMESITE` | no | `lax` (new, code task C5) |
| `GOOGLE_CLIENT_ID` | no | from Google Cloud |
| `GOOGLE_CLIENT_SECRET` | yes | from Google Cloud |
| `GOOGLE_REDIRECT_URI` | no | `https://wikognito.duckdns.org/api/auth/google/callback` |
| `GOOGLE_ADMIN_EMAILS` | yes | your Google email(s), comma-separated |
| `PUBLISH_SECRET` | yes | optional (`openssl rand -hex 32`). Empty disables the HTTP publish route. Not needed since the API self-publishes. |
| `SMTP_URL` | yes | empty = log only; or Brevo URL |
| `SMTP_FROM` | no | new (C7); only if `SMTP_URL` set |
| `WIKIPEDIA_USER_AGENT` | no | descriptive UA with contact |
| `ARTICLE_BACKUP_DIR` | no | `/data/wikipedia-articles` (mounted from `/srv/wikognito/articles`) |
| `LOG_LEVEL` | no | `info` |
| `RATE_LIMIT_*` | no | defaults are fine (auth 120, game 60, admin 30, public 120 per minute). Note: `trustProxy` is on, so limits are per real client IP. |
| `PORT` / `BACKEND_PORT` / `HOST` | no | leave unset; backend defaults to 4000 on 0.0.0.0. If set, keep Caddy's upstream in sync. |

Frontend (build args, set in compose `build.args`, **not** runtime secrets):

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `https://wikognito.duckdns.org` (inlined at build; rebuild the frontend image to change it) |
| `NEXT_PUBLIC_ILLUSTRATIONS_PACK` | `none` |

Compose / Caddy: `SITE_ADDRESS=wikognito.duckdns.org`.

Never put server secrets in any `NEXT_PUBLIC_*` variable. There is no `SESSION_SECRET`; sessions are random IDs in Redis/Postgres, not signed tokens.

---

## 11. Local testing plan (must pass before merge)

Goal: prove the production containers work end to end on the laptop, using production mode (`NODE_ENV=production`, `Secure` cookies, same-origin routing).

Setup trick: use `wikognito.localtest.me`, a public name that resolves to `127.0.0.1`. The backend refuses a `localhost` `FRONTEND_ORIGIN` in production, but allows this name. Use `SITE_ADDRESS=wikognito.localtest.me` with Caddy `tls internal` (self-signed; accept the browser warning once). Secure cookies work over that HTTPS.

Prerequisites on the laptop: Docker + Compose (present, Docker 28). The laptop's Node is 18, below the project's 20+ requirement. Running everything **inside containers avoids this**; running `pnpm test` on the host needs Node 20+ (use nvm/fnm, or run tests in a `node:22` container).

Checklist (all should pass):

1. `docker compose -f infrastructure/docker/docker-compose.prod.yml build` succeeds for backend and frontend (amd64).
2. `up -d`: `migrate` exits 0, then backend becomes healthy. `curl -k https://wikognito.localtest.me/health` and `/health/ready` return 200 with `postgres: ok, redis: ok`.
3. Postgres and Redis are **not** reachable from the host (`nc -z localhost 5432` / `6379` fail); only 80/443 are published.
4. Data bootstrap: copy the snapshots into the mounted dir, run `articles:restore` → 93 restored; `puzzles:generate --all` and `puzzles:validate` pass; `dossiers:seed` for the corpus files works; `GET /api/puzzles/today` returns a payload (opaque, no word dictionary).
5. Browser flow: home loads, how-to, begin case, guess words (no `/guess` network calls), reload keeps the attempt, win ceremony, share card.
6. **Cookie check:** DevTools → Application → Cookies shows `redactle_session` with `HttpOnly`, `Secure`, `SameSite=Lax`, host-only. Session persists across reload. Repeat in a private window and in Firefox/Safari if available.
7. Email/password register, login, logout; `/profile` and `/stats` load.
8. Admin: with your email in `GOOGLE_ADMIN_EMAILS` and a registered email account (or real Google OAuth if you add a localtest redirect), `/admin/articles`, `/admin/puzzles`, `/admin/dossiers` load; non-admin gets denied.
9. Rate limit sanity: behind Caddy the limiter keys on the client IP, not the Caddy container IP (hit an endpoint repeatedly, confirm 429 only after the threshold, and check logs for the client IP).
10. `docker compose restart redis`: site keeps working (degraded sessions only). `restart postgres`: `/health/ready` 503 then recovers.
11. **Backup + restore drill:** run `backup.sh` to a local directory, create a scratch Postgres, `pg_restore`, compare row counts for `Article`, `Puzzle`, `User`, `GameResult`.
12. `pnpm lint && pnpm typecheck && pnpm test && pnpm build` pass (Node 20+).
13. No secrets in the diff (`git diff main...HEAD`), `.env*` and article JSON untracked, images contain no `.env`/`data`/`ops`.

Then (recommended, requires owner OK to push the branch): repeat items 1–8 on the Oracle VM from the branch (arm64), using the real domain and real Google OAuth, before merging.

Merge only when 1–13 pass. Do not merge on "it builds".

---

## 12. Gotchas and things to keep in mind

1. **Do NOT run `pnpm db:seed` in production.** `apps/backend/prisma/seed.ts` creates `admin@redactle.local` / `redactle-admin` and `player@redactle.local` / `redactle-player`, public in the README and docs. On a public site that is an open admin account. Production admin = a Google (or email) account listed in `GOOGLE_ADMIN_EMAILS`.
2. **Crowd accounts.** On every startup and at midnight the API files fake "crowd" solves for 20 fake users (`*.wikognito@gmail.com`, password `password`; `apps/backend/src/modules/crowd/`). That is existing intended behavior (fills the leaderboard). Be aware they are loginable accounts with a known password if someone guesses an address. Optionally disable or change `CROWD_PASSWORD` in a separate decision; out of scope here unless the owner asks.
3. **`FRONTEND_ORIGIN` must equal the page origin exactly** (scheme + host, no trailing slash) or CORS and OAuth return break. `NEXT_PUBLIC_API_BASE_URL` must be what the browser calls. With one origin, both are the same string.
4. **`NEXT_PUBLIC_API_BASE_URL` is baked in at build.** Changing the domain later means rebuilding the frontend image (`--no-cache` if layers are reused). It is also in the CSP `connect-src`.
5. **Backend must not be directly exposed.** `trustProxy: true` means a client reaching the backend port could spoof `X-Forwarded-For` and dodge rate limits. Keep it on the internal Docker network.
6. **Never publish 5432/6379.** Docker's published ports bypass `ufw`/some iptables rules. Publish only Caddy's 80/443.
7. **Let's Encrypt:** DNS must resolve to the VM and port 80 must be reachable (both the OCI security list **and** the host iptables rule) before Caddy can issue a cert. Persist Caddy's `/data` volume.
8. **Arm64:** build images on the VM (or via buildx), never copy amd64 images. All used base images (`node`, `postgres`, `redis`, `caddy`) publish arm64 variants. Prisma engines are generated inside the image.
9. **Do not use `pnpm install --prod`** in the image (tsx and Prisma CLI are devDependencies).
10. **Prisma migrations:** only `migrate deploy` in production. Never `migrate dev`, `db push` or `db reset`. The first run applies all 10 migrations to an empty DB. The two migration folders (`apps/backend/prisma/migrations` and the visibility copy in `infrastructure/database/migrations`) differ slightly (the copy lacks `phase3_puzzle_pool` and `phase8_1_puzzle_stats`); the **backend one is authoritative**.
11. **Postgres data safety:** the data volume must live on persistent disk, backups run nightly, and the restore drill is done. `docker compose down -v` deletes the data volume; never use `-v` on the VM.
12. **Redis loses data on restart** unless RDB is enabled; that is acceptable (sessions only), but players who are mid-game keep local progress.
13. **Time zone:** daily puzzles are by **UTC date**. Keep the VM in UTC or at least do not rely on the host zone. The scheduler uses UTC internally.
14. **Resource sizing on 12 GB:** Postgres ~1 GB, backend ~0.5 GB, frontend ~0.5 GB, Redis ≤128 MB, Caddy small; `next build` may peak at 2–3 GB, so build while the stack is idle or add swap.
15. **Account/instance termination risk:** Oracle can reclaim idle instances or terminate accounts. Keep off-Oracle copies of: the latest DB dump, the article snapshots, the `ops/bulk-corpus` JSONs, and `.env.prod` (in a password manager).
16. **Don't exceed Always Free.** One A1 VM at 2 OCPU/12 GB; boot volume ≤ 200 GB total; no paid shapes/volumes/load balancers beyond free ones. Keep the budget alert.
17. **Docs vs code drift:** `docs/deployment.md` says `SameSite=Lax`; code uses `none` in production. Fix both in C5/C9.
18. **Local dev stays unchanged:** `pnpm infra:up` (dev compose on 5433/6380), `pnpm dev`, frontend on 3002. Do not edit the dev compose file.
19. **Mail:** outbound port 25 is blocked on OCI, use 587/465. Special characters in `SMTP_URL` credentials must be URL-encoded.
20. **Logs:** JSON on stdout; use `docker compose logs`. Rotate (`json-file` max-size) so logs cannot fill the disk. Never log secrets (the app already redacts).

---

## 13. Rollback and recovery

- **Bad deploy:** `git checkout <previous tag/commit>` on the VM, rebuild, `up -d`. Prisma migrations are forward-only; fix forward with a new migration. Do not hand-edit applied migrations.
- **Data loss / corrupt DB:** stop backend, restore the latest dump with `pg_restore` into a fresh volume, start backend.
- **VM lost (reclaimed/terminated):** create a new A1 VM, repeat owner tasks 3–14, `git clone`, restore the latest dump from Object Storage or your off-Oracle copy; if no dump exists, use the bootstrap path (section 7, C8) to rebuild articles/puzzles/dossiers. **Users and results are only recoverable from a dump.**
- **Domain change:** update DuckDNS, `.env.prod` (`FRONTEND_ORIGIN`, `GOOGLE_REDIRECT_URI`), Google Console entries, `SITE_ADDRESS`, and **rebuild the frontend** (build arg).

---

## 14. Master checklist

### Agent (code, on `deploy/oracle-always-free`)

- [ ] C1 Dockerfile (targets `backend`, `frontend`) + `.dockerignore`
- [ ] C2 `infrastructure/docker/docker-compose.prod.yml`
- [ ] C3 `infrastructure/docker/Caddyfile`
- [ ] C4 `.env.production.example` + `.gitignore` exception
- [ ] C5 `SESSION_COOKIE_SAMESITE` env + test
- [ ] C6 Backup/restore scripts + timer + restore drill doc
- [ ] C7 `SMTP_FROM` + mailer wiring + test
- [ ] C8 Data bootstrap script/doc
- [ ] Local test checklist (section 11) all green
- [ ] C9 Docs updated (deployment, what-is-built, environment, operations, troubleshooting, article-backups)
- [ ] C10 (optional) CI image build
- [ ] Commits are small, no secrets, `git diff main...HEAD` reviewed
- [ ] Owner approves → merge (path decided at that time)

### Owner (outside the repo)

- [ ] Oracle account, home region chosen, budget alert (1–2)
- [ ] VCN + ingress 80/443 + SSH restricted (3–4)
- [ ] A1 VM 2 OCPU/12 GB Ubuntu 24.04 aarch64, reserved IP (5–6)
- [ ] Decide PAYG upgrade vs accept reclamation risk (7)
- [ ] Host iptables 80/443 persisted (8)
- [ ] Docker/git/swap installed, repo cloned (9–10)
- [ ] Object Storage bucket + credentials for backups (11)
- [ ] DuckDNS subdomain → VM IP, token saved (12)
- [ ] Snapshots and corpus JSONs copied to `/srv/wikognito/` (13)
- [ ] `.env.prod` created, mode 600 (14)
- [ ] Google OAuth origin + redirect + admin emails (15–18)
- [ ] Wikipedia user agent chosen (19)
- [ ] Email decision (20)
- [ ] Post-launch: uptime monitor, quarterly restore drill, delete Render services (21–23)

---

## 15. Open questions to resolve with the owner

1. Is `wikognito.duckdns.org` free, and is that the name to use?
2. Home region for Oracle (closest to players with A1 capacity)?
3. Upgrade to Pay As You Go to avoid reclamation (recommended), or stay pure free?
4. Email: log-only for v1, or set up Brevo now?
5. Disable/rename the fake crowd accounts' known password (`password`)? (Optional hardening.)
6. Approve pushing the branch so it can be tested on the VM (arm64) before merging?
7. Merge path: branch → `develop` → `main`, or branch → `main`?

---

## Sources checked while researching (third-party unless noted)

- Oracle docs, Always Free resources: https://docs.oracle.com/iaas/Content/FreeTier/resourceref.htm
- OCI Always Free reclamation rules: https://oracommit.blogspot.com/2026/02/understanding-oci-always-free-compute.html
- Reported A1 allowance cut: https://braindetox.kr/en/posts/oracle_always_free_tier_reduced_2026.html
- Neon pricing (checked directly; not used in this plan, kept for reference): https://neon.com/pricing
- Free SMTP comparison: https://sendlayer.com/blog/best-free-smtp-servers/
- Free Docker hosting comparison: https://flywp.com/blog/9769/best-free-docker-hosting-platforms/
