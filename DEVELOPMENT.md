# Starting development on Wikognito

This is the **local setup and operator guide**: install, env, database, Wikipedia import, tests, and troubleshooting.

The public product description lives in [README.md](README.md).

A redacted Wikipedia word game. Internal packages remain `@redactle/*`.

Production operator docs: [docs/architecture.md](docs/architecture.md) · [docs/local-development.md](docs/local-development.md) · [docs/environment.md](docs/environment.md) · [docs/production.md](docs/production.md) · [docs/deployment.md](docs/deployment.md) · [docs/operations.md](docs/operations.md) · [docs/troubleshooting.md](docs/troubleshooting.md)

- **Frontend:** Next.js (App Router) — local guess matching, localStorage persistence, Google/email sign-in, archive, history, profile, sharing, admin tools
- **Backend:** Fastify — puzzle delivery, Redis gameplay sessions, Google OAuth, email/password accounts, durable official results, Wikipedia import, puzzle pool
- **Data:** PostgreSQL (Prisma) + Redis
- **Packages:** shared contracts, puzzle engine, article provider, ingestion pipeline

Guessing a word does **not** call the API. Matching runs in `@redactle/puzzle-engine` inside the browser after decoding an opaque puzzle payload.

`GET /api/puzzles/today` reads the persisted **DailyPuzzle** assignment. Wikipedia is never required during gameplay.

**Authentication upgrades persistence; it does not unlock gameplay.** Anonymous visitors can play and share today's result immediately.

### Phase 8 — Game feel

- Title-word strip and unlabeled fog bar during play
- Ink reveal, scroll-to-hit, optional quiet sound (off by default)
- Today’s case card and a one-time how-to
- Filed-result ceremony and a visual share card that never includes the answer
- Mobile guess history in a sheet so the article stays readable

### Phase 6 — Frontend, analytics, scoring, leaderboard

- Dark-mode-first redesign with persistent light mode
- Desktop split game layout and mobile sticky guessing controls
- Server-authoritative Guess Accuracy (`hitGuessCount`)
- Deterministic difficulty-normalized score (`scoreVersion = 1`)
- Today's authenticated official-win leaderboard (`/leaderboard`)
- Activity calendar and compact stats trends
- Archive play states; history/profile/settings/auth revamp

### Phase 5 — Player experience, archive, sharing, accounts

- Public paginated puzzle archive (`/archive`, `/?puzzle=<id>`)
- First attempt at a puzzle is official; archive official results update general stats, never streaks
- Private paginated history, profile, and settings
- Share Result (copy + `navigator.share`) never includes the answer
- Email verification, forgot/reset password, change password, account deletion
- Google-only accounts are not forced to create a password

### Phase 4 — Identity, claiming, stats, admin auth

- Sign in with Google (no email/password)
- Anonymous session is claimed on login; the current game is not reset
- Official results are one per User + Puzzle; replay does not affect stats
- Authenticated stats: played / won / given up / win rate / streaks / averages
- `/admin` and `/api/admin/*` require `role = ADMIN`

### Phase 3 — Article → Puzzle Pool → Daily Puzzle

- Generate a validated puzzle from a stored Article (`pnpm puzzles:generate`)
- Common words stay visible, including in titles; punctuation/symbols/apostrophes/hyphens are visible boundaries; numbers are guessable
- Valid puzzles enter the **READY** pool; publishing assigns one puzzle to a UTC date
- `pnpm puzzles:publish-today` is idempotent
- Modest admin UI at `/admin/puzzles` (generate / validate / preview / publish today)


- Paste a Wikipedia URL in `/admin/articles` or import via CLI
- Backend normalizes the URL to a stable `externalId` (`wikipedia:en:Pet_door`)
- Existing articles are returned as `ALREADY_EXISTS` without calling Wikipedia again
- New articles are fetched from MediaWiki, converted from wikitext to plaintext, and stored
- Import does **not** generate a puzzle
- Play any stored article from `/admin/play` (preview only; does not replace today's puzzle)

---

## Prerequisites

- Node.js **20+** (developed on 22)
- pnpm **10+**
- Docker + Docker Compose

---

## Installation

```bash
cd redactle
pnpm install
cp .env.example .env
```

### Environment

Edit `.env` if needed. For local Docker Compose, the defaults work:

```env
DATABASE_URL=postgresql://redactle:redactle_dev@localhost:5433/redactle
REDIS_URL=redis://localhost:6380
BACKEND_PORT=4000
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
ARTICLE_SOURCE=LOCAL
WIKIPEDIA_API_URL=https://en.wikipedia.org/w/api.php
WIKIPEDIA_USER_AGENT=Wikognito/1.0 (contact@example.com)
WIKIPEDIA_REQUEST_DELAY_MS=500
PUZZLE_GENERATOR_VERSION=2.0.0

# Google OAuth — create a Web client in Google Cloud Console.
# Authorized redirect URI: http://localhost:4000/api/auth/google/callback
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:4000/api/auth/google/callback
FRONTEND_ORIGIN=http://localhost:3002
# Comma-separated Google emails that receive ADMIN on every login
GOOGLE_ADMIN_EMAILS=you@gmail.com,admin@redactle.local
SMTP_URL=
```

Docker Compose maps Postgres to host port **5433** and Redis to **6380** so they do not clash with common local installs on 5432/6379.

Required for gameplay: `DATABASE_URL`, `REDIS_URL`, `BACKEND_PORT`, `NEXT_PUBLIC_API_BASE_URL`.

Required for Wikipedia import: `WIKIPEDIA_USER_AGENT` (descriptive, with contact). `WIKIPEDIA_API_URL` defaults to the English Wikipedia API.

Required for Sign in with Google: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. Emails in `GOOGLE_ADMIN_EMAILS` receive `ADMIN` on Google or email/password login.

Seeded local accounts (after `pnpm db:seed`):

- Admin: `admin@redactle.local` / `redactle-admin`
- Player: `player@redactle.local` / `redactle-player`
- Crowd: 20 Gmail accounts, password `password` (for example `aarav.wikognito@gmail.com`, display name Aarav). Names are Indian first names or oddly specific handles. A different subset files each daily puzzle, with varied guess counts, accuracy, and scores. The API refreshes that on startup and when today's puzzle is served.

Include `admin@redactle.local` in `GOOGLE_ADMIN_EMAILS` so the seeded admin stays ADMIN after login.

`GET /api/puzzles/today` reads the persisted DailyPuzzle assignment. Wikipedia import always uses the Wikipedia provider. `PUZZLE_GENERATOR_VERSION` is stamped on generated puzzles.

---

## Start infrastructure

```bash
pnpm infra:up
```

Stop:

```bash
pnpm infra:down
```

---

## Database

Generate Prisma client and apply migrations:

```bash
pnpm --filter @redactle/backend prisma:generate
pnpm db:migrate:deploy
```

Seed today's dummy puzzle **through the ingestion pipeline**:

```bash
pnpm db:seed
```

To create a new migration during development:

```bash
pnpm db:migrate
```

Reset (destructive — wipes Postgres including imported articles; snapshots under `data/wikipedia-articles/` are kept):

```bash
pnpm db:reset
pnpm articles:restore
```

Clear Redis:

```bash
pnpm redis:clear
```

Ingest dummy article (generate READY + publish today if missing):

```bash
pnpm ingest:dummy
```

Generate / validate / publish from the stored Article corpus (no Wikipedia):

```bash
pnpm puzzles:generate -- --article-id article-ada-lovelace
pnpm puzzles:generate -- --all
pnpm puzzles:validate
pnpm puzzles:publish-today
```

`--force` regenerates a READY/DRAFT puzzle for the same article + generator version. It never overwrites a **PUBLISHED** puzzle.

---

## Wikipedia article import

Admin UI requires `role = ADMIN` (Google account in `GOOGLE_ADMIN_EMAILS`, or seeded `admin@redactle.local`):

```text
http://localhost:3002/admin/articles
http://localhost:3002/admin/puzzles
http://localhost:3002/admin/play
```

CLI (same import service as the API):

```bash
pnpm articles:import:wikipedia --url "https://en.wikipedia.org/wiki/Pet_door"

pnpm articles:import:wikipedia --file services/article-ingestion/data/wikipedia-urls.txt
```

Both `/wiki/Pet_door` and `/w/index.php?title=Pet_door&action=raw` resolve to `wikipedia:en:Pet_door`. Re-running the file import is idempotent.

Successful Wikipedia imports (admin UI and CLI) also write a JSON snapshot under `data/wikipedia-articles/` (override with `ARTICLE_BACKUP_DIR`). Dummy/seed articles are not snapshotted. Wikipedia wikitext is gitignored.

Imported articles live in the Docker Postgres volume `redactle_pg_data`. Removing `node_modules`, `.next`, caches, or `apps/backend/prisma/*.db` does **not** delete them. They **are** lost by `pnpm db:reset`, `docker compose down -v`, a new machine, or a code-only zip.

```bash
pnpm articles:backup     # snapshot Wikipedia rows already in Postgres
pnpm articles:restore    # re-insert from snapshots (no Wikipedia call)
```

After a database wipe:

```bash
pnpm db:migrate
pnpm db:seed
pnpm articles:restore
```

Puzzles are not backed up. Restore articles, then generate/publish as usual.

To keep snapshots outside this repo (survives deleting the project folder):

```bash
export ARTICLE_BACKUP_DIR="$HOME/.local/share/redactle/wikipedia-articles"
```

### Code-only copy (sharing)

`git archive` respects `.gitignore` (no `node_modules`, `.next`, `.env`, or article snapshots):

```bash
git archive --format=tar.gz --prefix=redactle/ HEAD -o ../redactle-code-only.tar.gz
```

Or a working-tree copy that also drops untracked junk:

```bash
rsync -a \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude 'out' \
  --exclude 'dist' \
  --exclude 'coverage' \
  --exclude '.turbo' \
  --exclude '.cache' \
  --exclude '.tmp' \
  --exclude '.env' \
  --exclude 'data/wikipedia-articles' \
  ./ ../redactle-code-only/
```

Keep article snapshots out of the share zip. Copy them aside if you need them later:

```bash
cp -a data/wikipedia-articles ../redactle-article-backups
```

### Admin play (stored article preview)

Open `/admin/puzzles` to generate READY puzzles from stored articles, re-validate payloads, and publish today's assignment. Preview still uses `/admin/play/:articleId` (same generator, no Puzzle row).

Open `/admin/play`, pick a stored article (or paste its database `id` / `externalId`), and play it as a redacted puzzle. The backend generates an opaque payload on the fly and does **not** persist a Puzzle row or change `/api/puzzles/today`. Completions are local-only (no official stats).

Examples of stored ids:

- `article-ada-lovelace` / `local:ada-lovelace`
- Wikipedia rows use a UUID `id` and an `externalId` like `wikipedia:en:Pinocchio`

---

## Run development servers

```bash
pnpm dev
```

- Frontend: http://localhost:3002 (or the port Next prints)
- Backend: http://localhost:4000

---

## Tests / quality

```bash
pnpm test
pnpm test:puzzle-engine
pnpm test:backend
pnpm test:frontend
pnpm typecheck
pnpm lint
```

Automated tests do **not** call live Wikipedia. Provider/import tests use fixtures and mocks.

---

## API smoke tests

```bash
curl http://localhost:4000/api/health
curl -c cookies.txt -b cookies.txt http://localhost:4000/api/puzzles/today
```

Full contract docs: [docs/api/README.md](docs/api/README.md)  
Architecture: [docs/architecture/overview.md](docs/architecture/overview.md)

---

## How to play (Phase 8)

1. Open http://localhost:3002 (or the port Next prints)
2. First visit: dismiss how-to, then **Begin** today’s case
3. Inspect Network → `/api/puzzles/today` — response should be opaque (`payload`), not a word dictionary
4. Guess words — matching is local (no `/guess` calls). Hits ink into the article; title words fill the strip
5. Win by revealing the **non-common title words** (dummy puzzle: `ada` then `lovelace`)
6. Reload or close the browser — completed state remains
7. Use **Replay** for an explicit new attempt (prior official `GameResult` rows stay)
8. Optionally **Sign in** (`/login`) with Google or email/password — the current game continues; official results become durable stats at `/stats`

Tokenizer rules (generator v2): common words from `COMMON_VISIBLE_WORDS` stay visible everywhere; punctuation, symbols, apostrophes, and hyphens are visible boundaries; numbers are guessable.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| PostgreSQL unavailable | `pnpm infra:up`, confirm port `5433` free, check `DATABASE_URL` |
| Redis unavailable | `pnpm infra:up`, confirm port `6380` free, check `REDIS_URL` |
| Port already in use | Change `BACKEND_PORT` / stop the other process on 3002 or 4000 |
| Migration failure | Ensure Postgres is healthy, then `pnpm db:migrate` |
| Missing env vars | `cp .env.example .env` and fill required values — backend fails fast with a clear message |
| Puzzle not found | Run `pnpm db:seed`, `pnpm ingest:dummy`, or `pnpm puzzles:publish-today` |
| Frontend can't reach API | Confirm `NEXT_PUBLIC_API_BASE_URL` and that `pnpm dev` started the backend |
| Wikipedia import fails with User-Agent error | Set `WIKIPEDIA_USER_AGENT` in `.env` |

---

## Monorepo layout

```text
apps/frontend          Next.js game UI + /admin/articles + /admin/puzzles + /admin/play
apps/backend           Fastify API + Prisma
packages/shared        Shared types/schemas
packages/puzzle-engine Pure game/puzzle logic
packages/test-utils    Test helpers
services/article-provider
services/article-ingestion
infrastructure/docker  PostgreSQL + Redis
docs/                  API + architecture
```
