# Deployment (Oracle Cloud Always Free)

Wikognito runs on one Oracle Always Free Arm VM. Docker Compose runs everything behind Caddy on a single origin. Secrets live only in `.env.prod` on the server. Never commit them.

```text
Internet :80/:443
   └── Caddy (automatic Let's Encrypt)
         ├── /api/*, /health, /health/ready → backend:4000 (Fastify)
         └── everything else                → frontend:3002 (Next.js)
                                      backend → postgres:5432, redis:6379 (internal network only)
```

Only Caddy publishes ports. Postgres, Redis, the backend and the frontend are reachable only on the internal Docker network. The backend trusts `X-Forwarded-For` in production, so it must never be exposed directly.

Files: `Dockerfile` (targets `backend`, `frontend`), `infrastructure/docker/docker-compose.prod.yml`, `infrastructure/docker/Caddyfile`, `.env.production.example`. Local dev (`pnpm infra:up`, `pnpm dev`) is unchanged.

## Why one origin

The browser only talks to `https://<domain>`. The session cookie is first-party, so set `SESSION_COOKIE_SAMESITE=lax`. Without that variable the backend keeps its older default (`none` in production, `lax` otherwise), which suits a split frontend/API host deployment but is fragile under third-party-cookie blocking.

`FRONTEND_ORIGIN` and `NEXT_PUBLIC_API_BASE_URL` are the same string (scheme + host, no trailing slash). `NEXT_PUBLIC_API_BASE_URL` is inlined into the frontend at **build** time (and into the CSP `connect-src`), so changing the domain means rebuilding the frontend image.

## Environment

Copy `.env.production.example` to `.env.prod` (mode 600) and fill it in. Names and meaning are listed in that file and in [environment.md](environment.md). Generate secrets with `openssl rand -hex 32`.

Commands below use a shorthand:

```bash
dc() { docker compose -f infrastructure/docker/docker-compose.prod.yml --env-file .env.prod "$@"; }
```

If `.env.prod` is elsewhere, set `WIKOGNITO_ENV_FILE` (the backend `env_file`) and pass the same path to `--env-file`.

## First deploy

1. Create the VM and network (Oracle console): A1.Flex, 2 OCPU / 12 GB, Ubuntu 24.04 aarch64, security list ingress for TCP 80 and 443 (and 22 from your IP only). Do not open 5432, 6379, 4000 or 3002.
2. On the VM, open the host firewall too (Oracle's Ubuntu image rejects everything but SSH):
   ```bash
   sudo iptables -I INPUT 5 -p tcp --dport 80 -j ACCEPT
   sudo iptables -I INPUT 5 -p tcp --dport 443 -j ACCEPT
   sudo netfilter-persistent save
   ```
   Check the position with `sudo iptables -L INPUT -n --line-numbers`: the rules must sit before the REJECT rule.
3. Install Docker Engine + compose plugin (official Docker apt repo), git, and 2-4 GB swap (`next build` peaks at 2-3 GB).
4. Point DNS (DuckDNS) at the VM's public IP. Caddy cannot issue a certificate until DNS resolves and port 80 is reachable.
5. `git clone` the repo, copy `.env.production.example` to `.env.prod`, fill it in.
6. Copy the data that is not in git: article snapshots to `ARTICLES_DIR`, dossier JSON to `CORPUS_DIR`. The backend container runs as uid 1000; make `ARTICLES_DIR` writable by it (`sudo chown 1000 <dir>`) so imports can write snapshots.
7. Start: `dc up -d --build`. The `migrate` service runs `prisma migrate deploy` and exits 0 before the backend starts.
8. Load data: `infrastructure/docker/scripts/bootstrap-data.sh` (restore snapshots, generate and validate puzzles, seed dossiers, publish today). Safe to re-run.
9. Verify: `curl https://<domain>/health/ready` returns `postgres: ok, redis: ok`, and `/api/puzzles/today` returns a puzzle.

Never run `pnpm db:seed` in production: it creates public demo accounts (`admin@redactle.local`). Admin access comes from `GOOGLE_ADMIN_EMAILS`.

## Google sign-in

In the Google Cloud OAuth web client add:

- Authorized JavaScript origin: `https://<domain>`
- Authorized redirect URI: `https://<domain>/api/auth/google/callback`

Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, the same `GOOGLE_REDIRECT_URI`, and `GOOGLE_ADMIN_EMAILS` in `.env.prod`. If the consent screen is in Testing, only listed test users can sign in.

## Daily puzzle

No cron is needed. The API publishes today's puzzle at startup and at 00:00 UTC, and `GET /api/puzzles/today` publishes lazily if none exists. Keep the VM clock on UTC.

## Updating

```bash
git pull
dc up -d --build
```

Migrations are forward-only (`migrate deploy`). Never use `migrate dev`, `db push` or `db reset`, and never `docker compose down -v` (it deletes the Postgres volume). Rollback: check out the previous commit and run `dc up -d --build`; fix schema problems forward with a new migration.

## Backups

Postgres is self-managed, so backups are mandatory. See [operations.md](operations.md#backups). Also keep copies off Oracle of the latest dump, the article snapshots, the corpus JSON, and `.env.prod`.

## Local production test

To exercise the production containers on a laptop, use `wikognito.localtest.me` (resolves to 127.0.0.1) with a self-signed cert:

```text
SITE_ADDRESS=wikognito.localtest.me
CADDY_TLS=tls internal
HTTP_PORT=18080            # only if 80/443 are taken locally
HTTPS_PORT=18443
NEXT_PUBLIC_API_BASE_URL=https://wikognito.localtest.me:18443
FRONTEND_ORIGIN=https://wikognito.localtest.me:18443
```

`dc up -d --build`, then open `https://wikognito.localtest.me:18443` and accept the certificate warning once. Do not use `localhost` as `FRONTEND_ORIGIN`: production mode rejects it.

## Notes

- Always Free compute can be reclaimed when idle (7 days of low CPU, network and memory). Check Oracle's current rules; the backups are the recovery path.
- Outbound mail: leave `SMTP_URL` empty to log password-reset links to `dc logs backend`. OCI blocks port 25; use 587 or 465 if a provider is added later, and URL-encode credentials in `SMTP_URL`.
- Architecture and the full migration rationale: [oracle-deployment-plan.md](oracle-deployment-plan.md).
- The previous Render setup (separate frontend and API hosts, `SameSite=None`) is retired.
