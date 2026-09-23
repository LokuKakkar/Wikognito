# Database

Prisma owns schema and migrations for this project.

- Schema: [`apps/backend/prisma/schema.prisma`](../../apps/backend/prisma/schema.prisma)
- Migrations: [`apps/backend/prisma/migrations`](../../apps/backend/prisma/migrations)
- Seed (runs ingestion pipeline): [`apps/backend/prisma/seed.ts`](../../apps/backend/prisma/seed.ts)

A copy of applied migrations also lives under `infrastructure/database/migrations` for visibility.

```bash
pnpm db:migrate
pnpm db:seed
```
