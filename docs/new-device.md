# New device (code-only copy)

Use this when you have **source code only** on a machine that has never run Wikognito. No existing `.env`, `node_modules`, Docker volume, or article JSON.

The original README is unchanged. This page is the full local bootstrap.

## What a code-only copy does not include

| Missing | Why | What to do |
|---------|-----|------------|
| `.env` | Gitignored secrets | `cp .env.example .env` |
| `node_modules` | Not in git / zip | `pnpm install` |
| Docker volume `redactle_pg_data` | Lives on the old machine | Fresh Postgres; migrate + seed |
| `data/wikipedia-articles/*.json` | Gitignored Wikipedia text | Copy snapshots separately, or re-import |
| Puzzles / DailyPuzzle / users | Those live in Postgres, not in the zip | Seed dummy, or restore articles then generate |

A typical `git archive` or rsync exclude list also drops `.next`, `dist`, and `.env`. That is correct.

## 1. Install tools

- Node.js 20+ (developed on 22)
- pnpm 10+
- Docker + Docker Compose (used only for Postgres and Redis)

## 2. Install dependencies and create env

```bash
pnpm install
cp .env.example .env
```

Local Compose defaults already in `.env.example`:

```env
DATABASE_URL=postgresql://redactle:redactle_dev@localhost:5433/redactle
REDIS_URL=redis://localhost:6380
BACKEND_PORT=4000
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
FRONTEND_ORIGIN=http://localhost:3002
WIKIPEDIA_USER_AGENT="Wikognito/1.0 (you@example.com)"
```

Required to start: `DATABASE_URL`, `REDIS_URL`, `NEXT_PUBLIC_API_BASE_URL`.

Google OAuth and `SMTP_URL` are optional locally. Email verification is off, so new accounts are already verified. Empty SMTP logs password-reset mail to the backend console. Wikipedia import needs a real `WIKIPEDIA_USER_AGENT` (Wikimedia rejects empty or generic browser UAs).

## 3. Start data stores, migrate, seed

```bash
pnpm infra:up
pnpm db:migrate
pnpm db:seed
pnpm dev
```

- Frontend: http://localhost:3002
- Backend: http://localhost:4000
- Compose maps Postgres to host **5433** and Redis to **6380** so they do not clash with local 5432/6379.

Seeded accounts (include `admin@redactle.local` in `GOOGLE_ADMIN_EMAILS` so the admin stays ADMIN after login):

- Admin: `admin@redactle.local` / `redactle-admin`
- Player: `player@redactle.local` / `redactle-player`

After seed you can play the **dummy Ada Lovelace** daily puzzle. That is enough to confirm the new machine works.

## 4. If you also brought article snapshots

Article JSON is **not** in the code zip. If you copied `data/wikipedia-articles/*.json` (or set `ARTICLE_BACKUP_DIR`) beside the project:

```bash
pnpm articles:restore
pnpm puzzles:generate -- --all
pnpm puzzles:validate
pnpm puzzles:publish-today
```

Restore is idempotent on `externalId`. It does **not** recreate puzzles. Details: [article-backups.md](article-backups.md).

If you have no snapshots, import later from `/admin/articles` or:

```bash
pnpm articles:import:wikipedia --url "https://en.wikipedia.org/wiki/Pet_door"
```

Then generate and publish as above.

## 5. Useful checks

```bash
curl http://localhost:4000/health
curl http://localhost:4000/health/ready
pnpm test
```

| Problem | Fix |
|---------|-----|
| Postgres / Redis unavailable | `pnpm infra:up`; confirm ports 5433 / 6380 |
| Puzzle not found | `pnpm db:seed` or `pnpm puzzles:publish-today` |
| Frontend cannot reach API | `NEXT_PUBLIC_API_BASE_URL` and both `pnpm dev` processes |
| Wikipedia User-Agent error | Set `WIKIPEDIA_USER_AGENT` in `.env` |

## 6. Destructive reset on this machine

`pnpm db:reset` and `docker compose down -v` wipe Postgres (including imported articles). JSON under `data/wikipedia-articles/` is kept on disk.

```bash
pnpm db:reset
pnpm articles:restore
pnpm puzzles:generate -- --all
pnpm puzzles:publish-today
```
