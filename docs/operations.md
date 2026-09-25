# Operations

## Puzzle pipeline

```text
Wikipedia URL → article ingestion → validation → puzzle generation → puzzle validation → READY
READY → validation → DailyPuzzle → PUBLISHED
```

| Step | CLI | Admin UI |
|------|-----|----------|
| Import | `pnpm articles:import:wikipedia -- <url>` | `/admin/articles` |
| Generate | `pnpm puzzles:generate -- --article-id <id>` | `/admin/puzzles` |
| Validate | `pnpm puzzles:validate` | `/admin/puzzles` |
| Corpus (import + generate) | `pnpm corpus:process -- --file <urls.txt>` | `POST /api/admin/corpus` |
| Seed dossier | `pnpm dossiers:seed -- --file <seed.json>` | `POST /api/admin/dossiers/seed` |
| Publish | `pnpm puzzles:publish-today` | `/admin/puzzles` |

Batch Wikipedia import is sequential with `WIKIPEDIA_REQUEST_DELAY_MS` between fetches. There is no automated Wikipedia refresh.

`GET /api/puzzles/today` is read-only and never publishes. Publishing is idempotent, UTC-based, and will not replace an already published assignment or publish an invalid puzzle.

## Daily publish

`DailyPuzzle` is UTC. Publication time is **00:00 UTC**. The scheduler must stay thin: it only calls the existing publish endpoint. Selection, validation, assignment, and Redis cache updates stay in Fastify.

Normal production path: an external scheduler (for example cron-job.org) at 00:00 UTC, plus a retry a few minutes later:

```bash
curl -X POST "$BACKEND_URL/api/internal/puzzles/publish-today" \
  -H "Authorization: Bearer $PUBLISH_SECRET"
```

The endpoint picks a random unused READY puzzle (article never used in a daily), re-validates it, skips invalids, and writes `DailyPuzzle` + Redis. Manual publish from `/admin/puzzles` still works.

| Result | Meaning |
|--------|---------|
| `PUBLISHED` | New daily assigned |
| `ALREADY_PUBLISHED` | Safe retry; today’s row already exists |
| `NO_CANDIDATE` | No valid unused READY puzzle. Today is **not** filled with yesterday’s puzzle. Inspect `/admin/puzzles` |

Returns 503 if `PUBLISH_SECRET` is unset, 401 if the bearer token is wrong.

Local/operator CLI (same function):

```bash
pnpm puzzles:publish-today
```

## Dossiers

A dossier is a themed collection of existing puzzles. Playing a case file does not change `DailyPuzzle`. Completing a dossier case is official-once for that puzzle; `source` is `ARCHIVE` unless the case is also today’s daily.

```bash
pnpm dossiers:seed -- --file <seed.json>
```

Then publish the dossier from `/admin/dossiers`. Production can use the same JSON via `POST /api/admin/dossiers/seed` (admin session) or run the CLI locally against the Render **external** `DATABASE_URL`. Chunk large URL lists; free-tier HTTP requests can time out. Seed URL lists used for operator bulk import stay off the repo.

## Daily publish events

Useful log events: `daily_publish_success`, `daily_publish_already_published`, `daily_publish_no_candidate`, `daily_publish_failed`, `corpus_import_started`, `corpus_article_imported`, `corpus_article_failed`, `corpus_puzzle_generated`, `corpus_puzzle_failed`, `dossier_created`, `dossier_published`, `dossier_case_added`.

## Health and logs

- `/health` — liveness
- `/health/ready` — Postgres required; Redis optional/`degraded`
- Logs: JSON lines on stdout/stderr with `requestId`
- Useful events: `request`, `request_error`, `auth_failure`, `game_completed`, `game_give_up`, `puzzle_fetch_failed`, `daily_publish_success`, `daily_publish_already_published`, `daily_publish_no_candidate`, `daily_publish_failed`, `redis_error`, `redis_reconnecting`

Never log passwords, tokens, cookies, Authorization headers, article plaintext, or full Redis sessions.

## Redis failure

Redis is cache and temporary state. PostgreSQL remains the durable source of truth.

| Lost Redis state | Effect |
|------------------|--------|
| Today's puzzle cache | Served from DailyPuzzle / Postgres |
| Gameplay session blob | Server recovery fails; `localStorage` still has the attempt |
| OAuth state | In-progress Google sign-in must restart |
| Rate-limit counters | Limits temporarily skipped (`skipOnError`) |

Users, articles, puzzles, DailyPuzzle, official results, stats, and leaderboard rows are not stored only in Redis.

## PostgreSQL failure

API routes return controlled 5xx with a generic message and a `requestId`. `/health` stays 200; `/health/ready` returns 503.

## Authentication notes (accepted)

- Email verification is not required to play
- Google-only accounts can delete without a password
- CSRF relies on `SameSite=lax` plus production CORS allowlisting
- Admin role is assigned from `GOOGLE_ADMIN_EMAILS`

## Brand assets

Drop final artwork at:

- `apps/frontend/public/favicon.ico`
- `apps/frontend/public/icon.svg`
- `apps/frontend/public/apple-touch-icon.png`

## Performance baseline

Record locally with `pnpm --filter @redactle/frontend build` and `curl -w '%{time_total}\n' -o /dev/null -s` against a running API.

| Signal | How to read it | Typical local note (2026-08-25) |
|--------|----------------|----------------------------------|
| Frontend First Load JS | `next build` route table | Shared 102 kB; `/` 140 kB; `/stats` 137 kB; other player routes ~134–135 kB |
| Backend startup | time until `/health` is 200 | Single Fastify process + Prisma + Redis connect |
| `GET /api/puzzles/today` | curl time_total | Redis cache after first hit |
| `GET /api/stats` | curl time_total | Postgres aggregation |
| `GET /api/leaderboard/today` | curl time_total | Official wins for the UTC date |
| `GET /api/puzzles/archive` | curl time_total | Paginated DailyPuzzle list |

Do not optimize for imaginary high traffic. Re-measure if article HTML or leaderboard queries become slow.

## Dependency review

`pnpm audit --audit-level=high` on 2026-08-25 reported transitive findings only:

- `next` → `sharp` / `postcss` (image/CSS toolchain)
- `prisma` → `deepmerge-ts` (config merge)

None are in the authentication request path. Left un-upgraded to avoid a blind Next/Prisma bump. Re-check before release; upgrade only if a finding is exploitable in our deployment.
