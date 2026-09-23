# Go live on a real domain

Phase 7 made the **repository** production-ready. It did not provision a host, DNS, or TLS. This is the operator checklist.

The stack stays one frontend, one backend, one Postgres, one Redis. No Kubernetes.

## You must provide

| Item | Notes |
|------|--------|
| Domain + TLS | e.g. `https://play.example.com` (site) and an API origin |
| Two public origins, or one reverse proxy | Browser calls `NEXT_PUBLIC_API_BASE_URL` with cookies |
| PostgreSQL | Managed or Compose on a VPS |
| Redis | Managed or Compose on a VPS |
| Process supervisor | systemd, a PaaS start command, etc. |
| Daily scheduler | cron shortly after **00:00 UTC** |
| Google OAuth (if you want Google sign-in) | Production redirect URI |
| Optional SMTP | Otherwise verification/reset mail stays in server logs |
| Real logo files | Replace placeholders in `apps/frontend/public/` |
| Article corpus | Restore JSON or import, then generate a READY pool |

The operator also owns DNS records, certificate renewal, Postgres backups, and watching `/health` + logs.

## Environment (set before `pnpm build`)

Next.js inlines `NEXT_PUBLIC_API_BASE_URL` at **build** time. Change it, then rebuild.

Required:

```env
NODE_ENV=production
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
FRONTEND_ORIGIN=https://play.example.com
NEXT_PUBLIC_API_BASE_URL=https://api.example.com
```

`FRONTEND_ORIGIN` must be a **non-localhost** https origin. Production config fails fast otherwise. Production CORS allowlists that origin only.

Google (optional but typical):

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://api.example.com/api/auth/google/callback
GOOGLE_ADMIN_EMAILS=you@gmail.com
```

In Google Cloud Console, add the production authorized redirect URI and the site origin.

Other useful keys:

```env
WIKIPEDIA_USER_AGENT="Wikognito/1.0 (https://play.example.com; you@example.com)"
PUBLISH_SECRET=long-random-string
SMTP_URL=
LOG_LEVEL=info
ARTICLE_BACKUP_DIR=/var/lib/wikognito/wikipedia-articles
```

Empty `PUBLISH_SECRET` disables the HTTP publish fallback (CLI still works). Empty `SMTP_URL` logs mail to the console.

Never put server secrets in `NEXT_PUBLIC_*`.

## Deploy steps

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm verify:production
pnpm db:migrate:deploy
pnpm --filter @redactle/backend start
pnpm --filter @redactle/frontend start
```

`verify:production` prints **key names only**, never values.

Backend `start` is `tsx src/server.ts`. Frontend `start` is `next start` (port 3002 unless you change it). Put both behind TLS.

Probe:

```bash
curl https://api.example.com/health
curl https://api.example.com/health/ready
```

`/health` is process liveness (no dependency checks). `/health/ready` is 200 if Postgres is up; Redis may be `degraded`. 503 only if Postgres is down.

## Load the puzzle corpus

A new production database has **no** Wikipedia articles and **no** daily puzzle until you load them.

Option A — restore snapshots you already have ([article-backups.md](article-backups.md)):

```bash
pnpm articles:restore
pnpm puzzles:generate -- --all
pnpm puzzles:validate
pnpm puzzles:publish-today
```

Option B — import on the server (needs outbound HTTPS to Wikipedia):

```bash
pnpm articles:import:wikipedia --file path/to/urls.txt
pnpm puzzles:generate -- --all
pnpm puzzles:publish-today
```

Do this **before** the first scheduled midnight publish. Keep extra READY puzzles so a missed cron does not leave tomorrow empty.

`GET /api/puzzles/today` never publishes. If nothing is assigned for the UTC date, players get 404.

## Daily publish

Primary (run on the server, once after 00:00 UTC):

```bash
pnpm puzzles:publish-today
```

Retries are safe (`ALREADY_PUBLISHED`).

HTTP fallback if cron cannot run CLI:

```bash
curl -X POST "https://api.example.com/api/internal/puzzles/publish-today" \
  -H "Authorization: Bearer $PUBLISH_SECRET"
```

503 if `PUBLISH_SECRET` is unset; 401 if the token is wrong.

## Branding

Replace the placeholders (metadata already points at these paths):

- `apps/frontend/public/favicon.ico`
- `apps/frontend/public/icon.svg`
- `apps/frontend/public/apple-touch-icon.png`

Then rebuild the frontend.

## What you still do not get from the repo

- A chosen PaaS or VPS image
- Automated Let’s Encrypt
- A production SMTP vendor
- Automated Wikipedia refresh
- Multi-region / replicas / extra API processes

Those remain operator choices. See [what-is-built.md](what-is-built.md) for the full gap list.

## Rollback (short)

- App: redeploy the previous git revision and restart both processes.
- Schema: do not auto-rollback Prisma. Restore a Postgres backup or ship a forward-fix migration.
- Redis: safe to flush. Official results stay in Postgres. In-flight OAuth and server session recovery are lost; `localStorage` gameplay survives.
