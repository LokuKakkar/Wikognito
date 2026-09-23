# Wikognito architecture

Wikognito is a redacted-Wikipedia word game. Internal package names remain `@redactle/*`; the public product name is Wikognito.

```text
Internet
   ↓
Wikognito Frontend (Next.js)
   ↓
Wikognito Backend (Fastify)
   ↓
PostgreSQL + Redis
```

One API process, one frontend, one Postgres, one Redis. No Kubernetes, extra API servers, or workers.

## Ownership

| Layer | Owns |
|-------|------|
| Browser | Guess matching, reveal, local gameplay state |
| Backend | Auth, puzzle delivery, session recovery, completion, stats, admin |
| Redis | Recoverable gameplay sessions, OAuth state, today's puzzle cache |
| PostgreSQL | Users, articles, puzzles, DailyPuzzle, official results, stats |

Guessing a word does **not** call the API. `GET /api/puzzles/today` never publishes. `DailyPuzzle` is the UTC daily assignment source of truth. Published puzzles are immutable.

## Runtime flow

```text
publishDailyPuzzle → DailyPuzzle + PUBLISHED Puzzle
        ↓
Redis cache  redactle:puzzle:v2:today:{YYYY-MM-DD}
        ↓
Backend API  ←→  Redis sessions + cache
        ↓
PostgreSQL Users / Sessions / GameResults
        ↓
Frontend decodes payload → local engine → localStorage
```

Wikipedia is an article source, not a gameplay dependency. See [docs/architecture/overview.md](architecture/overview.md) for tokenizer, compact payload, and import details.

## Security boundaries

- `/api/admin/*` requires `role = ADMIN`
- `/api/me/history` is owner-scoped
- Scores, completion timestamps, and accuracy are server-derived
- Public APIs never return article plaintext
- Reset/verification tokens are hashed, single-use, and expiring
