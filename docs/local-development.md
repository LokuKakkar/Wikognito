# Local development

## Prerequisites

- Node.js 20+
- pnpm 10+
- Docker + Docker Compose (Postgres and Redis only)

## Setup

```bash
pnpm install
cp .env.example .env
pnpm infra:up
pnpm db:migrate
pnpm db:seed
pnpm dev
```

- Frontend: http://localhost:3002
- Backend: http://localhost:4000
- Health: http://localhost:4000/health
- Readiness: http://localhost:4000/health/ready

Seeded accounts (see `.env` `GOOGLE_ADMIN_EMAILS`):

- Admin: `admin@redactle.local` / `redactle-admin`
- Player: `player@redactle.local` / `redactle-player`

## Common commands

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Backend + frontend watch |
| `pnpm test` | All package tests |
| `pnpm lint` / `pnpm typecheck` / `pnpm build` | Quality gates |
| `pnpm articles:import:wikipedia -- <url>` | Import one article |
| `pnpm puzzles:generate -- --article-id <id>` | Generate a READY puzzle |
| `pnpm puzzles:validate` | Validate the pool |
| `pnpm puzzles:publish-today` | Assign today's DailyPuzzle |

See [environment.md](environment.md) for every variable.
