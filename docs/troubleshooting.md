# Troubleshooting

## Backend will not start

- `Invalid configuration: DATABASE_URL` — `.env` is missing or not loaded
- Production `FRONTEND_ORIGIN` error — set a real https origin, not localhost
- Port in use — change `BACKEND_PORT`

## `/health/ready` is 503

PostgreSQL is down or `DATABASE_URL` is wrong. Redis `degraded` alone must not 503.

## Today's puzzle 404

No `DailyPuzzle` for the current UTC date and no unused READY puzzle. The API publishes automatically on startup and on `GET /api/puzzles/today`. If today is still missing, the READY pool is empty. Confirm with `pnpm puzzles:validate`, or publish from `/admin/puzzles`.

## Google sign-in loops or fails

- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` must match the Google console
- Production `FRONTEND_ORIGIN` must be the real site
- Redis must be up for OAuth state (restart sign-in after a Redis flush)

## Email never arrives

`SMTP_URL` empty logs mail to the backend console. Production mail is out of scope.

## 429 Too many requests

Auth, game sync/complete, admin, and public reads are rate-limited. Defaults are per minute. Raise `RATE_LIMIT_*` if a shared NAT is hitting auth.

## CORS / cookies in production

Browser origin must equal `FRONTEND_ORIGIN`. `NEXT_PUBLIC_API_BASE_URL` must be the API the browser actually calls. Cookies are `Secure` only when `NODE_ENV=production`.

## Redis was flushed

Players keep local progress. Official completed games remain in Postgres. Server session recovery and in-progress OAuth are gone.

## Migration failed

`pnpm db:migrate:deploy` applies Prisma migrations only. Do not `db push`. Restore from backup or ship a new forward migration. Do not edit applied SQL in place on production.
