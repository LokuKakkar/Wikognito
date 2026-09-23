# Deployment

This repository does not ship application Dockerfiles. Postgres and Redis may run via the existing Compose file or any managed equivalents.

## Operator steps

1. Provision PostgreSQL and Redis.
2. Set environment variables from [environment.md](environment.md).
3. Point `FRONTEND_ORIGIN` at the real Wikognito origin and `NEXT_PUBLIC_API_BASE_URL` at the API origin **before** `pnpm build` (Next inlines the public API URL).
4. `pnpm install --frozen-lockfile`
5. `pnpm build`
6. `pnpm verify:production`
7. `pnpm db:migrate:deploy` against the production database
8. Start backend (`tsx src/server.ts`) and frontend (`next start`)
9. Probe `/health` and `/health/ready`
10. Schedule daily publish (see [operations.md](operations.md))

## Rollback

- Application: redeploy the previous git revision and restart both processes.
- Database: do not auto-rollback Prisma migrations. Restore from a backup or apply a forward-fix migration.
- Redis: safe to flush. Durable data is in PostgreSQL. In-flight server session recovery and in-progress Google OAuth are lost; local gameplay in `localStorage` survives.

## Scheduling

The operator attaches cron (or any scheduler) to `pnpm puzzles:publish-today`. An HTTP fallback exists if the scheduler cannot run CLI on the server.
