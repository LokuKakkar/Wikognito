# Deployment

Live Render hosting for Wikognito. Credentials stay in the Render dashboard. Do not commit secrets.

What is already running: [what-is-built.md](what-is-built.md). Variable catalog: [environment.md](environment.md).

```text
GitHub  https://github.com/LokuKakkar/Wikognito.git
   │
   ├── Render Web Service → Next.js frontend (apps/frontend, next start)
   │
   ├── Render Web Service → Fastify backend (apps/backend, tsx src/server.ts)
   │
   ├── Render Postgres → PostgreSQL
   │
   └── Render Key Value → Redis-compatible store
```

Vercel is not used. No custom domain yet. Docker Compose stays local-only (`pnpm infra:up`). Do not add a `render.yaml` until you choose to.

All four Render resources must be in the **same region**. Free web services can reach datastores on the private network only in that region. Use **Internal** connection strings, not external ones.

Current production origins:

- Frontend: `https://wikognito.onrender.com`
- Backend: `https://wikognito-api.onrender.com`

Auth and cookies are working on those hosts. A new service would still be `https://<service-name>.onrender.com`. Use the name Render assigns. Do not invent a different URL.

## Services

### PostgreSQL — Render Postgres, Free

- Purpose: articles, puzzles, users, official results.
- Root directory: not applicable.
- Build / start: managed. No app command.
- Required by the backend: `DATABASE_URL` (secret).
- Health: backend `GET /health/ready` returns 503 when Postgres is down.
- Free limits: one free database per workspace, 1 GB, expires 30 days after creation, no backups. Upgrade before expiry or the data is deleted after a 14-day grace period.

### Redis — Render Key Value, Free

- Purpose: gameplay sessions, in-progress Google OAuth state, rate-limit counters, puzzle cache. Official results are in Postgres.
- Required by the backend: `REDIS_URL` (secret). Paste the internal URL exactly (`redis://` or `rediss://`).
- Health: `/health/ready` stays 200 when Redis is down and reports Redis as `degraded`. Postgres down is the only 503.
- Free limits: one free instance, memory only. A restart drops sessions and in-progress sign-in. Browser `localStorage` gameplay and Postgres results remain.

### Backend — Render Web Service, Free, Node

- Purpose: Fastify API.
- Root directory: repository root (the pnpm workspace). Not `apps/backend`.
- Runtime: Node. Do not use Docker.
- Build: `pnpm install --frozen-lockfile && pnpm --filter @redactle/backend... build`
- Pre-deploy: `pnpm db:migrate:deploy`
- Start: `pnpm --filter @redactle/backend start`
- Health check path: `/health/ready`
- `pnpm install` must not use `--prod`. Start runs TypeScript through `tsx`, and migrate uses the Prisma CLI. Both are devDependencies.
- The process binds `HOST` or `0.0.0.0`, and `PORT` (Render sets `PORT`) or else `BACKEND_PORT` (local default 4000). Do not set `BACKEND_PORT` on Render.
- Dependencies: Postgres and Key Value internal URLs, then the frontend origin once you have chosen its service name.

Backend environment variables:

| Variable | Secret? | Required? | Where the value comes from |
| --- | --- | --- | --- |
| `NODE_ENV` | No | Yes | Set to `production` |
| `DATABASE_URL` | Yes | Yes | Render Postgres, Internal Database URL |
| `REDIS_URL` | Yes | Yes | Render Key Value, Internal Redis URL |
| `FRONTEND_ORIGIN` | No | Yes | `https://<frontend-service-name>.onrender.com` with no trailing slash |
| `GOOGLE_CLIENT_ID` | No | For Google sign-in | Google Cloud OAuth client |
| `GOOGLE_CLIENT_SECRET` | Yes | For Google sign-in | Google Cloud OAuth client |
| `GOOGLE_REDIRECT_URI` | No | For Google sign-in | `https://<backend-service-name>.onrender.com/api/auth/google/callback` |
| `GOOGLE_ADMIN_EMAILS` | Yes | For admin | Comma-separated Google emails you choose |
| `PUBLISH_SECRET` | Yes | For external daily publish | A long random string you generate. Empty disables the HTTP publish route |
| `SMTP_URL` | Yes | No | Leave empty on the free tier. Render free blocks outbound ports 25, 465, and 587. Mail is written to logs |
| `WIKIPEDIA_USER_AGENT` | No | For Wikipedia import | `Wikognito/1.0 (https://<frontend-service-name>.onrender.com; you@example.com)` |
| `LOG_LEVEL` | No | No | `info` |

Do not set `PORT` or `HOST` yourself. Render sets `PORT`.

### Frontend — Render Web Service, Free, Node

- Purpose: Next.js App Router. This is a Node server, not a static site. Static Site hosting will not run `next start`.
- Root directory: repository root.
- Build: `pnpm install --frozen-lockfile && pnpm --filter @redactle/frontend... build`
- Start: `pnpm --filter @redactle/frontend start`
- Health check: none required. The site should load in a browser.
- `NEXT_PUBLIC_API_BASE_URL` is inlined at **build** time, including Content-Security-Policy `connect-src`. Set it before the first build. Changing it requires a new build (clear the build cache if Render reuses an old one).

Frontend environment variables:

| Variable | Secret? | Required? | Where the value comes from |
| --- | --- | --- | --- |
| `NODE_ENV` | No | Yes | Set to `production` |
| `NEXT_PUBLIC_API_BASE_URL` | No | Yes | `https://<backend-service-name>.onrender.com` with no trailing slash. Set before build |
| `NEXT_PUBLIC_ILLUSTRATIONS_PACK` | No | No | `none` |

## Health

| Path | Meaning |
| --- | --- |
| `GET /health` | Process is up. No dependency checks. `{ "status": "ok" }` |
| `GET /health/ready` | 200 if Postgres is up. Redis may be `degraded`. 503 only if Postgres is down |

Responses do not include connection strings.

## Cookies and CORS

Production CORS allows only `FRONTEND_ORIGIN`, with credentials. It does not use `*`.

The session cookie is `redactle_session`: `HttpOnly`, `Path=/`, `SameSite=Lax`, `Secure` in production, no `Domain` (host-only on the API). The browser sends it with `credentials: "include"` because both hosts are `*.onrender.com` (same site). Keep `SameSite=Lax`. Do not switch to `None` for this setup.

`NODE_ENV=production` also makes Fastify trust Render's forwarded client IP for rate limits.

## Prisma

From the repository root, with `DATABASE_URL` already in the environment:

```bash
pnpm install --frozen-lockfile
pnpm --filter @redactle/backend prisma:generate
pnpm db:migrate:deploy
```

`pnpm db:migrate:deploy` runs `prisma migrate deploy`. Locally it loads the repo `.env` when that file exists. On Render there is no `.env`; the pre-deploy command uses the dashboard environment. Do not run `pnpm db:migrate` or `prisma migrate dev` against production. Do not auto-rollback migrations.

`postinstall` in `@redactle/backend` also runs `prisma generate`.

## Manual OAuth Configuration

The callback route in code is `GET /api/auth/google/callback`. After Google succeeds, the API redirects to `FRONTEND_ORIGIN/`.

In Google Cloud Console, on the OAuth Web client:

- Authorized redirect URI: `https://<backend-service-name>.onrender.com/api/auth/google/callback`
- Authorized JavaScript origin: `https://<frontend-service-name>.onrender.com`

Set the same callback on the backend as `GOOGLE_REDIRECT_URI`. It must match character for character. Keep the local redirect URI (`http://localhost:4000/api/auth/google/callback`) if you still sign in locally.

Gameplay does not require Google. Email/password and anonymous play work without these values. Admin import uses `GOOGLE_ADMIN_EMAILS`.

## Daily puzzle

Free web services have no shell and no cron. They also sleep after 15 minutes without traffic.

Load the first articles from the admin UI (`/admin/articles`, `/admin/puzzles`) after an admin Google sign-in. The API assigns today's puzzle on startup, at 00:00 UTC while the process is awake, and on `GET /api/puzzles/today` when that UTC date has no assignment. An empty READY pool returns 404 for today.

Free Render has no cron and sleeps when idle, so the request path is what publishes after a night with no traffic. An external scheduler is optional:

```bash
curl -X POST "https://<backend-service-name>.onrender.com/api/internal/puzzles/publish-today" \
  -H "Authorization: Bearer <PUBLISH_SECRET>"
```

503 means `PUBLISH_SECRET` is unset. 401 means the token does not match. Retries after a successful publish return `ALREADY_PUBLISHED`. `NO_CANDIDATE` means the unused READY pool is empty or invalid — do not invent a fallback puzzle.

To populate production dossiers without SSH: sign in as admin and use `/admin/dossiers` / `POST /api/admin/corpus`, or run `pnpm dossiers:seed` locally with the Render **external** `DATABASE_URL` and `WIKIPEDIA_USER_AGENT`.

## Local development

Unchanged. `pnpm infra:up`, `cp .env.example .env`, `pnpm db:migrate`, `pnpm dev`. Frontend dev stays on port 3002. `pnpm --filter @redactle/frontend start` uses port 3002 unless `PORT` is set.

## Rollback

- App: redeploy the previous git revision and restart both web services.
- Database: do not auto-rollback Prisma. Restore is unavailable on free Postgres. Ship a forward-fix migration.
- Redis: safe to lose. Durable data is in Postgres.

# MANUAL ACTIONS REQUIRED

Do these in order. Values below are placeholders. Copy the real strings from each dashboard. Do not put them in git.

1. Confirm the GitHub repository.
   - WHERE: GitHub
   - WHAT TO CLICK/CREATE: The existing repo `LokuKakkar/Wikognito` is already the git remote. Push this branch if Render should build it.
   - VALUE TO COPY: the repository URL
   - WHERE TO PUT IT: Render, when connecting the service

2. Create a Render account.
   - WHERE: https://dashboard.render.com
   - WHAT TO CLICK/CREATE: Sign up. No credit card is required for free instances.
   - VALUE TO COPY: none
   - WHERE TO PUT IT: nowhere

3. Create PostgreSQL.
   - WHERE: Render Dashboard → New → Postgres
   - WHAT TO CLICK/CREATE: Name it, pick a region, instance type Free. Create it.
   - VALUE TO COPY: **Internal Database URL**
   - WHERE TO PUT IT: backend service environment variable `DATABASE_URL`

4. Create Redis.
   - WHERE: Render Dashboard → New → Key Value
   - WHAT TO CLICK/CREATE: Same region as Postgres. Instance type Free.
   - VALUE TO COPY: **Internal Redis URL** (`redis://` or `rediss://` as shown)
   - WHERE TO PUT IT: backend `REDIS_URL`

5. Choose both web service names before creating them.
   - WHERE: a note on your side, then the Render create form
   - WHAT TO CLICK/CREATE: Two names. The public origins will be `https://<backend-name>.onrender.com` and `https://<frontend-name>.onrender.com`.
   - VALUE TO COPY: those two origins, with no trailing slash
   - WHERE TO PUT IT: backend `FRONTEND_ORIGIN` and `GOOGLE_REDIRECT_URI`; frontend `NEXT_PUBLIC_API_BASE_URL`

6. Create the backend web service.
   - WHERE: Render Dashboard → New → Web Service → this GitHub repo
   - WHAT TO CLICK/CREATE: Node, Free, same region, root directory empty (repo root). Build `pnpm install --frozen-lockfile && pnpm --filter @redactle/backend... build`. Pre-deploy `pnpm db:migrate:deploy`. Start `pnpm --filter @redactle/backend start`. Health check path `/health/ready`.
   - VALUE TO COPY: the live backend origin after the first healthy deploy
   - WHERE TO PUT IT: confirm it matches `https://<backend-name>.onrender.com`. Put that origin in the frontend variable in the next step.

7. Enter backend environment variables.
   - WHERE: backend service → Environment
   - WHAT TO CLICK/CREATE: `NODE_ENV`, `DATABASE_URL`, `REDIS_URL`, `FRONTEND_ORIGIN`. Add Google variables in step 9. Add `PUBLISH_SECRET` if you will schedule publish. Leave `SMTP_URL` empty. Do not set `PORT`.
   - VALUE TO COPY: none from here
   - WHERE TO PUT IT: this service only. Trigger a deploy after saving.

8. Create the frontend web service.
   - WHERE: Render Dashboard → New → Web Service (not Static Site)
   - WHAT TO CLICK/CREATE: Same repo, Node, Free, same region, repo root. Build `pnpm install --frozen-lockfile && pnpm --filter @redactle/frontend... build`. Start `pnpm --filter @redactle/frontend start`. Before the first build, set `NODE_ENV=production`, `NEXT_PUBLIC_API_BASE_URL` to the backend origin, and `NEXT_PUBLIC_ILLUSTRATIONS_PACK=none`.
   - VALUE TO COPY: the live frontend origin
   - WHERE TO PUT IT: backend `FRONTEND_ORIGIN` if the name differs from what you predicted. Redeploy the backend after any change.

9. Configure Google OAuth.
   - WHERE: Google Cloud Console → APIs & Services → Credentials → OAuth client (Web)
   - WHAT TO CLICK/CREATE: Authorized JavaScript origin = frontend origin. Authorized redirect URI = `https://<backend-name>.onrender.com/api/auth/google/callback`.
   - VALUE TO COPY: Client ID and Client secret
   - WHERE TO PUT IT: backend `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` (the same callback URL), and `GOOGLE_ADMIN_EMAILS` (your Google email). Redeploy the backend.

10. Test production login.
    - WHERE: the frontend origin, `/login`
    - WHAT TO CLICK/CREATE: Sign in with Google, then sign out, then refresh. The session cookie should persist across refresh.
    - VALUE TO COPY: none
    - WHERE TO PUT IT: nowhere

11. Load a puzzle.
    - WHERE: `/admin/articles` and `/admin/puzzles` on the frontend, signed in as an admin email
    - WHAT TO CLICK/CREATE: Import at least one Wikipedia article, generate and validate a puzzle, publish today.
    - VALUE TO COPY: none
    - WHERE TO PUT IT: nowhere. Then open `/` and confirm today's case loads, a guess works, and refresh keeps the attempt.

12. Schedule daily publish.
    - WHERE: an external HTTPS cron you control
    - WHAT TO CLICK/CREATE: `POST` the backend `/api/internal/puzzles/publish-today` shortly after 00:00 UTC, header `Authorization: Bearer <PUBLISH_SECRET>`
    - VALUE TO COPY: none into git
    - WHERE TO PUT IT: the scheduler's secret storage, and backend `PUBLISH_SECRET` if not set yet
