# Environment variables

The catalog lives in [`.env.example`](../.env.example). Copy it to `.env`. Never commit secrets.

## Required to start

| Name | Secret | Purpose |
|------|--------|---------|
| `DATABASE_URL` | yes | PostgreSQL |
| `REDIS_URL` | yes | Redis |
| `NEXT_PUBLIC_API_BASE_URL` | no | Browser API origin (only public frontend var) |

## Production-strict

| Name | Secret | Purpose |
|------|--------|---------|
| `NODE_ENV=production` | no | Secure cookies, sanitized 500s, CORS allowlist |
| `FRONTEND_ORIGIN` | no | Must be a non-localhost origin. CORS, OAuth return, email links |

`pnpm verify:production` loads config in production mode and prints **key names only**.

## Optional

| Name | Secret | Purpose |
|------|--------|---------|
| `BACKEND_PORT` | no | Listen port when `PORT` is unset (default 4000) |
| `PORT` | no | Platform listen port. Render sets it. Overrides `BACKEND_PORT` |
| `HOST` | no | Listen address (default `0.0.0.0`) |
| `SESSION_COOKIE_NAME` | no | Internal cookie name (`redactle_session`) |
| `SESSION_TTL_SECONDS` | no | Session TTL |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | yes | Google OAuth |
| `GOOGLE_REDIRECT_URI` | no | OAuth callback |
| `GOOGLE_ADMIN_EMAILS` | yes | Admin allowlist |
| `SMTP_URL` | yes | Mail; empty logs to console |
| `PUBLISH_SECRET` | yes | HTTP daily-publish fallback |
| `LOG_LEVEL` | no | `debug` / `info` / `warn` / `error` |
| `RATE_LIMIT_*` | no | Per-minute ceilings |
| `WIKIPEDIA_*` | no | Admin/CLI/corpus import only |
| `WIKIPEDIA_IMPORT_CONCURRENCY` | no | Parallel corpus imports (default 2) |
| `DAILY_POOL_WARNING_THRESHOLD` | no | Admin unused-READY warning (default 7) |

Do not add `NEXT_PUBLIC_` copies of server secrets. There is no `SESSION_SECRET`; sessions are Redis IDs, not signed JWTs.
