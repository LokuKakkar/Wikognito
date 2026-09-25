# Article backups

Wikipedia article text is **not** in git. It lives in Postgres after import, and optionally as JSON snapshots you copy yourself.

```text
Wikipedia URL
    → import (admin UI or CLI)
    → Postgres Article row
    → optional JSON snapshot (articles only)
    → generate Puzzle (READY)
    → publish DailyPuzzle (PUBLISHED)
```

Gameplay never needs Wikipedia online. It needs a published DailyPuzzle (and a READY pool for future days).

## What is in a snapshot

`pnpm articles:backup` writes one JSON file per **Wikipedia** article already in Postgres (default directory `data/wikipedia-articles/`, override with `ARTICLE_BACKUP_DIR`).

Each file is versioned metadata plus `rawContent` / `sourceWikitext` / `externalId` / title / hashes. Dummy/seed articles (Ada Lovelace) are **not** snapshotted.

Successful admin/CLI Wikipedia imports also write a snapshot at import time.

## What is not in a snapshot

| Not included | Where it actually lives |
|--------------|-------------------------|
| READY / PUBLISHED puzzles | Postgres `Puzzle` |
| Daily assignment | Postgres `DailyPuzzle` |
| Users, sessions, official results, stats, leaderboard | Postgres |
| Active gameplay / OAuth state | Redis + browser `localStorage` |

Restoring JSON **does not** recreate today’s puzzle. After restore you must generate and publish.

A full production move of **users and stats** is a Postgres dump (`pg_dump` or the host’s backup), not this JSON.

## Share with another machine

Snapshots are gitignored (`data/wikipedia-articles/*.json`). Copy them **beside** the code, never inside the git commit.

On the machine that already imported articles:

```bash
pnpm articles:backup
cp -a data/wikipedia-articles ../wikognito-article-backups
```

Keep the folder outside the repo if you delete the project directory:

```bash
export ARTICLE_BACKUP_DIR="$HOME/.local/share/wikognito/wikipedia-articles"
pnpm articles:backup
```

Give the other person:

1. The code (git clone / code-only zip)
2. The JSON folder (separate copy)

Do not put `.env` in either share.

## Use locally

On the new machine, after [new-device.md](new-device.md) steps 1–3 (`install`, `.env`, `infra:up`, migrate, seed):

1. Place the JSON files in `data/wikipedia-articles/` **or** point `ARTICLE_BACKUP_DIR` at that folder.
2. Restore (idempotent on `externalId` — safe to re-run):

```bash
pnpm articles:restore
```

3. Build the puzzle pool and assign today:

```bash
pnpm puzzles:generate -- --all
pnpm puzzles:validate
pnpm puzzles:publish-today
```

`--force` on generate regenerates READY/DRAFT for the same article + generator version. It never overwrites a **PUBLISHED** puzzle.

If today’s DailyPuzzle already exists, publish returns `ALREADY_PUBLISHED` and keeps that assignment.

## Use when going live

Same snapshots, production database.

1. Copy the JSON onto the server (or object storage, then download).
2. Set `ARTICLE_BACKUP_DIR` if the path is not `data/wikipedia-articles`.
3. Ensure production `DATABASE_URL` is set and migrations have run (`pnpm db:migrate:deploy`).
4. `pnpm articles:restore`
5. `pnpm puzzles:generate -- --all` and `pnpm puzzles:validate`
6. Fill a READY pool **before** the first 00:00 UTC cron
7. `pnpm puzzles:publish-today` once for the launch UTC date
8. Schedule daily publish with an external HTTPS caller (`POST /api/internal/puzzles/publish-today`). See [deployment.md](deployment.md).

You can also import live with Wikipedia (`WIKIPEDIA_USER_AGENT` required) instead of restore. Restore is faster and does not call Wikimedia.

Do not treat article JSON as a rollback of player data. For that, restore the Postgres backup.

## After a local DB wipe

```bash
pnpm db:migrate
pnpm db:seed
pnpm articles:restore
pnpm puzzles:generate -- --all
pnpm puzzles:publish-today
```

Seed brings back the dummy article/accounts. Restore brings back Wikipedia rows. Generate/publish rebuilds the playable pool.
