# Production configuration

Wikognito is host-agnostic. After the operator provides valid environment variables:

```bash
pnpm install
pnpm build
pnpm verify:production
pnpm db:migrate:deploy
pnpm --filter @redactle/backend start
pnpm --filter @redactle/frontend start
```

Backend `start` runs TypeScript via `tsx` because workspace packages export `.ts` sources. `pnpm build` typechecks the backend and builds the Next.js frontend.

## Fail-fast

`loadConfig()` refuses to start when `DATABASE_URL` or `REDIS_URL` is missing. In `NODE_ENV=production` it also refuses a localhost `FRONTEND_ORIGIN`.

## Cookies and CORS

- Session cookie: `HttpOnly`, `SameSite=lax`, `Secure` in production
- Production CORS allowlists `FRONTEND_ORIGIN` only
- Development still reflects local origins

## Health

| Path | Meaning |
|------|---------|
| `GET /health` | Process liveness. No dependency checks. |
| `GET /health/ready` | 200 if PostgreSQL is up. Redis may be `degraded`. 503 only if PostgreSQL is down. |

Do not treat Redis blips as process death.

## Errors and logs

API errors keep `{ error: { code, message, requestId } }`. Production 500s are generic. Structured JSON logs include `timestamp`, `level`, `event`, `requestId`, `route`, `method`, `status`, `duration`. Response header: `X-Request-Id`.

## Migrations

Use `pnpm db:migrate:deploy` (`prisma migrate deploy`). Do not use `db push` or `migrate dev` in production. There are no automatic destructive migrations.
