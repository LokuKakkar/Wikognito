# Deployment checklist

Free Render deploy. Details and the order of clicks are in [deployment.md](deployment.md). Do not paste secret values into this file.

## GitHub

- [ ] Repository `LokuKakkar/Wikognito` is the remote you will connect
- [ ] The deployment commit is pushed
- [ ] Secrets checked: no `.env` with real credentials in git
- [ ] `.env` excluded (`.gitignore` ignores `.env` and `.env.*`)
- [ ] `.env.example` committed (names and local defaults only)

## Database

- [ ] Render account created
- [ ] PostgreSQL created (Free) in the chosen region
- [ ] Internal Database URL copied into backend `DATABASE_URL`
- [ ] Prisma migration completed (`pnpm db:migrate:deploy` as the backend pre-deploy command)
- [ ] Expiry noted: free Postgres ends 30 days after creation and has no backups

## Redis

- [ ] Key Value instance created (Free) in the same region
- [ ] Internal Redis URL copied into backend `REDIS_URL`
- [ ] Backend starts with that URL (`/health/ready` shows Redis `ok`, or `degraded` only during a blip)
- [ ] Restart data loss accepted: free Key Value does not persist sessions

## Backend

- [ ] Render web service created (Node, Free, repo root, not Docker)
- [ ] Build: `pnpm install --frozen-lockfile && pnpm --filter @redactle/backend... build`
- [ ] Pre-deploy: `pnpm db:migrate:deploy`
- [ ] Start: `pnpm --filter @redactle/backend start`
- [ ] Environment variables configured (`NODE_ENV`, `DATABASE_URL`, `REDIS_URL`, `FRONTEND_ORIGIN`)
- [ ] `PORT` left unset so Render can inject it
- [ ] Build succeeds
- [ ] `GET /health` returns `{ "status": "ok" }`
- [ ] `GET /health/ready` returns 200
- [ ] CORS uses the real frontend origin (`FRONTEND_ORIGIN`, no `*`)

## Frontend

- [ ] Render web service created (Node, Free, not a Static Site)
- [ ] `NEXT_PUBLIC_API_BASE_URL` set to the backend origin before the production build
- [ ] `NEXT_PUBLIC_ILLUSTRATIONS_PACK=none`
- [ ] Build: `pnpm install --frozen-lockfile && pnpm --filter @redactle/frontend... build`
- [ ] Start: `pnpm --filter @redactle/frontend start`
- [ ] Production build succeeds
- [ ] Frontend loads

## Authentication

- [ ] Google OAuth client configured
- [ ] Authorized redirect URI is `https://<backend-name>.onrender.com/api/auth/google/callback`
- [ ] Authorized JavaScript origin is the frontend origin
- [ ] `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GOOGLE_ADMIN_EMAILS` set on the backend
- [ ] Login works
- [ ] Logout works
- [ ] Session persistence works across refresh

## Application

- [ ] At least one article imported (`/admin/articles`)
- [ ] A puzzle generated, validated, and published for today (`/admin/puzzles`)
- [ ] Puzzle loads
- [ ] Guess works
- [ ] Results save
- [ ] Refresh works
- [ ] External scheduler calls `POST /api/internal/puzzles/publish-today` after 00:00 UTC
