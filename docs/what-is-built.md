# What is built (through Phase 8)

**Wikognito** is a redacted-Wikipedia word game. The player sees a hidden article and guesses words. Matching and revealing happen **in the browser**. A guess does not call the API.

The public product name is Wikognito. Internal packages, cookies, and Redis keys still use `@redactle/*` / `redactle_*`. That is intentional.

```text
Browser (guess loop, localStorage)
   ↓
Wikognito Frontend (Next.js)
   ↓
Wikognito Backend (Fastify)
   ↓
PostgreSQL (durable) + Redis (sessions / cache)
```

- **PostgreSQL** owns users, articles, puzzles, DailyPuzzle, official results, stats, leaderboard rows.
- **Redis** owns recoverable gameplay sessions, OAuth state, today’s puzzle cache, rate-limit counters.
- Wikipedia is an **import source**, not a gameplay dependency. `GET /api/puzzles/today` never publishes.

Authentication upgrades persistence. It does not unlock play. Anonymous visitors can play and share immediately.

---

## What you can do today

- Play today’s official puzzle and past archive puzzles
- Guess locally; reload without losing the current attempt (`localStorage`)
- Sign in with Google or email/password; claim an anonymous session
- Keep official stats, streaks (daily only), history, profile
- Appear on today’s authenticated official-win leaderboard
- Share a result that never includes the answer
- Import Wikipedia articles (admin UI or CLI)
- Generate / validate READY puzzles and publish today (admin UI or CLI)
- Preview a stored article at `/admin/play` without changing today’s puzzle

Local URLs after `pnpm dev`:

- Site: http://localhost:3002
- API: http://localhost:4000
- Health: http://localhost:4000/health
- Ready: http://localhost:4000/health/ready
- Admin: http://localhost:3002/admin/articles · `/admin/puzzles` · `/admin/play`

---

## Phase inventory

### Phases 1–2 — Core game

- pnpm monorepo: frontend, backend, shared types, puzzle engine, article provider, ingestion
- Dummy article gameplay (Ada Lovelace seed)
- Opaque compact puzzle payload (no plaintext article on public APIs)
- Client-side tokenizer / guess matching
- Redis gameplay sessions + localStorage persistence
- Docker Compose for **Postgres + Redis only**

### Phase 3 — Corpus and daily puzzle

- Wikipedia URL import (admin + CLI), stable `externalId` (`wikipedia:en:Title`)
- Articles stored in Postgres; import does not generate a puzzle
- Generate / validate READY pool from stored `rawContent`
- Common words stay visible; punctuation/symbols/apostrophes/hyphens are boundaries; numbers are guessable
- `DailyPuzzle` is the UTC source of truth
- `pnpm puzzles:publish-today` is idempotent and will not replace a published day
- Admin puzzle pool UI; admin play preview does not persist a Puzzle row

### Phase 4 — Identity and official results

- Sign in with Google (PKCE, Redis state)
- Anonymous session claimed on login; current game is not reset
- One official result per user (or anonymous session) per puzzle; replay does not change official stats
- Stats: played / won / given up / win rate / streaks / averages
- `USER` / `ADMIN`; `/api/admin/*` requires ADMIN (`GOOGLE_ADMIN_EMAILS`)

### Phase 5 — Accounts, archive, sharing

- Email/password register, login, verify, forgot/reset, change password, delete account
- Tokens hashed, single-use, expiring; reset invalidates sessions
- Public archive; first attempt at a puzzle is official
- Archive official results update general stats, never streaks
- Private history, profile, settings
- Share Result (copy + `navigator.share`) without the answer

### Phase 6 — Scoring and presentation

- Dark-mode-first UI with persistent light mode
- Server-authoritative guess accuracy (`hitGuessCount`)
- Deterministic difficulty-normalized score (`scoreVersion = 1`)
- Today’s authenticated official-win leaderboard
- Activity calendar and compact stats trends

### Phase 7 — Production readiness

- Player-facing Wikognito branding (logo files are placeholders)
- Documented env catalog; production refuses localhost `FRONTEND_ORIGIN`
- Backend `start` via `tsx` (workspace packages still export TypeScript)
- `GET /health` (liveness) and `GET /health/ready` (Postgres required; Redis may be degraded)
- Request IDs (`X-Request-Id`) on the existing `{ error: { code, message } }` envelope
- Structured JSON logs with secret redaction
- Frontend `error.tsx` / `global-error.tsx` / `not-found.tsx`
- Redis reconnect handlers; Redis is not the durable source of truth
- Redis-backed rate limits; production CORS allowlist; Helmet + Next security headers
- `POST /api/internal/puzzles/publish-today` behind `PUBLISH_SECRET` (CLI remains primary)
- GitHub Actions: lint, typecheck, tests, build
- Operator docs for env, deploy, operations, troubleshooting

### Phase 8 — Game feel

- Hit juice: ink reveal, scroll to the first new match, title-word strip, unlabeled fog bar
- Letter counts on click/focus only
- Today’s case intro and a one-time how-to
- Filed-result ceremony (score count-up, rank, streak, personal best, guest nudge after a win)
- Visual share card (title slots + guess-only fog strip; still no answer)
- Optional quiet Web Audio (off by default) in Settings
- Mobile guess history in a sheet; article stays full height
- Lucide line icons in chrome/HUD only
- Official-once rules, streaks, and score v1 are unchanged

---

## Intentional gaps

These are **not unfinished bugs**. Phase 7 left them out on purpose.

| Gap | Why |
|-----|-----|
| No application Dockerfiles | Host-agnostic deploy. Compose is Postgres + Redis only. |
| No automated Wikipedia refresh | Operator imports; no continuous crawler. |
| No production mail provider | Empty `SMTP_URL` logs mail to the console. |
| No weekly / monthly / all-time leaderboards | Today only. |
| No Kubernetes, extra API servers, workers, Kafka, DB replicas | Target ~1,000 users / 100 DAU. |
| No payments, native app, AI difficulty | Out of scope. |
| Email verification not required to play | Banner only; gameplay stays open. |
| Logo / favicon placeholders | Drop files in `apps/frontend/public/` when you have artwork. |
| Article JSON backups are gitignored | They contain Wikipedia text; they are not the git repo. |
| Article backups exclude puzzles, users, results | Restore articles, then generate and publish. |
| Some `pnpm audit` findings left un-upgraded | Transitive Next/Prisma toolchain only; no blind bump. |
| CSRF token beyond SameSite + CORS | Accepted residual risk. |
| Google-only accounts can delete without a password | No local password to confirm. |

---

## Related handbook pages

- [New device from a code-only copy](new-device.md)
- [Article backups](article-backups.md)
- [Go live](go-live.md)
