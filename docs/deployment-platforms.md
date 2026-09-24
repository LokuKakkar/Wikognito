# Platform reference

Internal notes for helping deploy Wikognito later. Operator steps live in [deployment.md](deployment.md). Do not store secret values, connection strings, OAuth client secrets, or `PUBLISH_SECRET` in this file. When a deploy exists, record only public origins and service names here.

Last prepared: 2026-09-24. Not deployed. No production URLs exist yet.

## What is used

| Role | Platform | Not used |
| --- | --- | --- |
| Source | GitHub `https://github.com/LokuKakkar/Wikognito.git` | — |
| Frontend | Render Web Service, Node, Free | Vercel, Render Static Site |
| Backend | Render Web Service, Node, Free | Docker on Render |
| PostgreSQL | Render Postgres, Free | Local Compose in production |
| Redis | Render Key Value, Free | A second Redis vendor |
| Custom domain | None yet | — |
| Cron | External HTTPS caller | Render cron (not on the free tier) |
| Mail | Logs only (`SMTP_URL` empty) | SMTP on ports 25, 465, 587 |

Same Render region for Postgres, Key Value, and both web services. Free web services can send private-network traffic to datastores in that region. They cannot receive private-network traffic, so the browser talks to both apps on public `https://<service-name>.onrender.com` URLs.

## Repository facts that deployment depends on

- pnpm workspace (`pnpm@10.32.1`, Node `>=20`). Root is the Render root directory. Packages: `@redactle/frontend`, `@redactle/backend`, `@redactle/shared`, `@redactle/puzzle-engine`, `@redactle/article-provider`, `@redactle/article-ingestion`.
- Backend start is `tsx src/server.ts`. Backend `build` is `tsc --noEmit`. There is no compiled server bundle. Install must include devDependencies (`tsx`, `prisma`, `dotenv-cli`). Never `pnpm install --prod`.
- Frontend is Next.js 15 App Router. `next build` then `next start`. `NEXT_PUBLIC_API_BASE_URL` is inlined at build time in `apps/frontend/next.config.ts` (client bundle and CSP `connect-src`). A dashboard change without a rebuild does nothing.
- Frontend `dev` stays `next dev --port 3002`. Frontend `start` is `next start --hostname 0.0.0.0 --port ${PORT:-3002}`.
- Backend listen: `PORT` if set, else `BACKEND_PORT`, else `4000`. Host: `HOST` or `0.0.0.0`. Implemented in `apps/backend/src/infrastructure/config/env.ts` and `apps/backend/src/server.ts`. Render sets `PORT`. Do not also set `BACKEND_PORT` on Render.
- `pnpm db:migrate:deploy` loads `../../.env` only when that file exists (local). Otherwise `prisma migrate deploy` uses the process environment (Render pre-deploy). Do not run `db:migrate` (`migrate dev`) in production.
- Migrations already exist in `apps/backend/prisma/migrations`. `postinstall` runs `prisma generate`.
- Health: `GET /health` liveness. `GET /health/ready` is 200 when Postgres is up; Redis failure is `degraded` with 200; Postgres failure is 503. Do not change that contract. Render health check path for the API is `/health/ready`.
- Production CORS allowlists `FRONTEND_ORIGIN` only, credentials on. Cookie `redactle_session` is `HttpOnly`, `Path=/`, `SameSite=Lax`, `Secure` in production, host-only. Two `*.onrender.com` hosts are same-site, so Lax is correct. Do not set `SameSite=None`.
- `trustProxy` is on only when `NODE_ENV=production`, so rate limits see the visitor IP behind Render.
- Google callback path is fixed: `GET /api/auth/google/callback`. Success redirects to `FRONTEND_ORIGIN/`.
- No worker process. Article import and puzzle publish CLIs live in `@redactle/article-ingestion`. Free Render web services have no shell, so the first corpus load is the admin UI.
- `GET /api/puzzles/today` never publishes. Empty database → 404 for today.
- Docker Compose (`infrastructure/docker/docker-compose.yml`) is local Postgres on host 5433 and Redis on host 6380. Do not require it for Render.

## Render commands

Backend web service:

```text
Build:      pnpm install --frozen-lockfile && pnpm --filter @redactle/backend... build
Pre-deploy: pnpm db:migrate:deploy
Start:      pnpm --filter @redactle/backend start
Health:     /health/ready
```

Frontend web service:

```text
Build: pnpm install --frozen-lockfile && pnpm --filter @redactle/frontend... build
Start: pnpm --filter @redactle/frontend start
```

Set frontend `NEXT_PUBLIC_API_BASE_URL` before the first build.

## Environment placement

Backend dashboard:

- `NODE_ENV=production`
- `DATABASE_URL` = Postgres **Internal** Database URL
- `REDIS_URL` = Key Value **Internal** URL, pasted as issued
- `FRONTEND_ORIGIN` = `https://<frontend-name>.onrender.com` (no trailing slash)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_ADMIN_EMAILS`
- `GOOGLE_REDIRECT_URI` = `https://<backend-name>.onrender.com/api/auth/google/callback`
- `PUBLISH_SECRET` = operator-generated random string, only if the HTTP publish cron is used
- `SMTP_URL` empty on free tier
- `WIKIPEDIA_USER_AGENT` when importing from the admin UI
- Do not set `PORT` or `HOST`

Frontend dashboard:

- `NODE_ENV=production`
- `NEXT_PUBLIC_API_BASE_URL` = `https://<backend-name>.onrender.com` (no trailing slash)
- `NEXT_PUBLIC_ILLUSTRATIONS_PACK=none`

Local defaults stay in `.env.example` (Docker). Production values are never written into the repo.

## Free-tier constraints to remember

- Web services sleep after 15 minutes idle and take about a minute to wake. 750 free instance hours per workspace per month, shared by both web services.
- No shell and no one-off jobs on free web services. No Render cron on the free plan. Daily publish is `POST /api/internal/puzzles/publish-today` with `Authorization: Bearer <PUBLISH_SECRET>` from an external scheduler shortly after 00:00 UTC.
- Free Postgres: one per workspace, 1 GB, expires 30 days after creation, then 14 days to upgrade, then deletion. No backups.
- Free Key Value: one per workspace, not persistent. Restart drops Redis sessions and in-progress OAuth. `localStorage` and Postgres official results survive.
- Outbound ports 25, 465, and 587 are blocked. Leave `SMTP_URL` empty. Verification and reset mail go to API logs.
- Ephemeral filesystem. Do not store article backups on the service disk. `ARTICLE_BACKUP_DIR` on the service will vanish on spin-down.

## Order when the operator is ready

1. Push the git branch they want Render to build.
2. Create free Postgres and free Key Value in one region. Copy internal URLs only.
3. Pick backend and frontend service names so the `onrender.com` origins are known before the first boot. Production refuses a localhost `FRONTEND_ORIGIN`.
4. Create the backend with env, build, pre-deploy migrate, start, health `/health/ready`.
5. Create the frontend web service with `NEXT_PUBLIC_API_BASE_URL` already set, then build.
6. Google Cloud redirect URI and JavaScript origin, then backend Google env, then redeploy the API.
7. Admin sign-in, import an article, generate, validate, publish today.
8. External cron for publish. Confirm `/health`, `/health/ready`, login, logout, refresh, guess.

## Still unknown until the operator does the manual steps

- Render account and region
- Service names and therefore both public origins
- `DATABASE_URL`, `REDIS_URL` (never write these down in git or in this file)
- Google OAuth client id/secret and admin emails
- `PUBLISH_SECRET`

When they return with those, ask only for public origins plus confirmation that the secret env vars are set. Do not ask them to paste database passwords, Redis URLs, or OAuth secrets into chat unless a specific failure cannot be diagnosed otherwise. Prefer they re-check the dashboard themselves.
