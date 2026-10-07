# Wikognito API (Phase 7)

Base URL (local): `http://localhost:4000`

Session identity is an HttpOnly cookie (`redactle_session` by default).  
Browsers send it automatically with `credentials: "include"`.  
For curl, use `-c cookies.txt -b cookies.txt`.

The cookie is an opaque session id. Identity is resolved server-side: `Session` (Postgres) → optional `User`. Do not put `userId` or `role` in the cookie.

**There is no guess API.** Word matching happens entirely in the browser after decoding the opaque puzzle payload.

Gameplay endpoints remain public. `/api/me` requires a signed-in User. `/api/admin/*` requires `role = ADMIN`.

`GET /api/puzzles/today` does **not** publish a puzzle. Daily assignment lives in `DailyPuzzle`.

---

## GET `/api/health`

```bash
curl http://localhost:4000/api/health
```

---

## GET `/api/health/dependencies`

Checks PostgreSQL and Redis.

---

## GET `/api/puzzles/today`

Returns today's **public puzzle DTO** with an opaque encoded payload.

Source of truth: `DailyPuzzle` for the UTC date → `Puzzle.clientPuzzleData`. Redis cache key `redactle:puzzle:v2:today:{YYYY-MM-DD}`.

**Response `200`**

```json
{
  "id": "puzzle-article-ada-lovelace-2-0-0",
  "puzzleNumber": 1,
  "scheduledDate": "2026-08-20",
  "generatorVersion": "2.0.0",
  "payload": "OPAQUE_BASE64URL_PAYLOAD"
}
```

Does **not** return:

- full article plaintext
- readable hidden-word dictionary
- `content` token arrays
- `title` / answer fields

The frontend decodes `payload` via `@redactle/puzzle-engine` (`decodeClientPayload`). Compact format is **V2** (`title` string + `titleTokenIndexes`).

```bash
curl -c cookies.txt -b cookies.txt http://localhost:4000/api/puzzles/today
```

**Errors**

| Code | Status |
|---|---|
| `PUZZLE_NOT_FOUND` | 404 |

---

## GET `/api/sessions/current`

Returns recoverable Redis session state (active **or terminal**).

**Response `200`** — `SessionState`  
**Response `204`** — no active session

---

## POST `/api/sessions/sync`

Stores browser-authoritative game state in Redis (including `WON` / `GAVE_UP`).

**Request**

```json
{
  "puzzleId": "puzzle-2026-08-13",
  "attemptId": "uuid",
  "status": "IN_PROGRESS",
  "guesses": ["english", "algorithm"],
  "startedAt": 1786530000000,
  "completedAt": null
}
```

---

## POST `/api/games/complete`

Persists a durable `GameResult` for a finished attempt.

Idempotent for `(sessionId, attemptId)`.

First completed attempt for a session+puzzle is `isOfficial: true` while anonymous.  
For a signed-in User, officialness is at most one result per **User + Puzzle**.  
Later attempts (replay) are `isOfficial: false` and do not inflate stats.

Guess count, completion time, and `hitGuessCount` are derived server-side (Redis guesses when present, then puzzle-engine replay). `completedAt` is the server clock. Official wins persist `score` + `scoreVersion = 1`. Give-up and replay persist `score = 0` and `scoreVersion = 0`. The client cannot submit score, accuracy, or timestamp.

**Request**

```json
{
  "puzzleId": "puzzle-2026-08-13",
  "attemptId": "uuid",
  "status": "WON",
  "guesses": ["ada", "lovelace"],
  "startedAt": 1786530000000,
  "completedAt": 1786531000000
}
```

---

## GET `/api/stats`

Official (non-replay) lifetime stats for the current **session cookie** (anonymous-friendly in-game tally).

---

## GET `/api/auth/google`

Starts Google OAuth. Sets a session cookie if needed, stores CSRF `state` (and PKCE) bound to that session, then redirects to Google.

---

## GET `/api/auth/google/callback`

Google redirect. Validates `state` against the current cookie, finds or creates `User` + `AuthIdentity` by Google `sub`, claims the anonymous session, then redirects to `FRONTEND_ORIGIN`.

Invalid or mismatched state returns `400`. Tokens are never sent to the browser.

---

## POST `/api/auth/register`

Create an email/password account and claim the current anonymous session.

**Request**

```json
{
  "email": "player@example.com",
  "password": "password123",
  "displayName": "Player"
}
```

Password must be at least 8 characters. Canonical identity is `AuthIdentity(EMAIL, email)`, not Google. While verification mail is disabled, the account is created with `emailVerified: true`.

`409 EMAIL_TAKEN` if that email is already registered.

---

## POST `/api/auth/login`

Sign in with email and password. Claims the current anonymous session. Role is `ADMIN` when the email is listed in `GOOGLE_ADMIN_EMAILS`. While verification mail is disabled, an unverified address is marked verified on this login.

`401 INVALID_CREDENTIALS` for unknown email or wrong password.

---

## POST `/api/auth/logout`

Clears `userId` on the current session. Same cookie and Redis game continue anonymously. Other device sessions stay signed in. Empty JSON bodies are accepted.

---

## GET `/api/me`

Requires a signed-in User. Returns `id`, `displayName`, `email`, `avatarUrl`, `role`, `emailVerified`, `hasPassword`, `providers`.

`401` if anonymous.

---

## GET `/api/me/stats`

Requires a signed-in User. Official results only (`GameResult` + `DailyPuzzle`):

```json
{
  "gamesPlayed": 23,
  "gamesWon": 18,
  "gamesGaveUp": 5,
  "winRate": 0.7826,
  "currentStreak": 4,
  "longestStreak": 9,
  "averageGuesses": 31.2,
  "averageCompletionTimeMs": 258000,
  "guessAccuracy": 0.71,
  "calendarStart": "2026-07-22",
  "activity": [{ "date": "2026-08-21", "puzzleNumber": 183, "status": "WON", "guessCount": 42, "durationMs": 312000 }],
  "trends": []
}
```

Replay is excluded. Average guesses and average completion time use official **wins** only.  
`guessAccuracy` is the mean of per-game hit-guess ratios when `hitGuessCount` exists.  
`calendarStart` is the earliest published `DailyPuzzle` date minus 30 UTC days (today if none).  
`activity` is official **daily** participation only from `calendarStart` onward (archive and replay stay inactive).  
Archive official results count toward general statistics. Only official **daily** results (`GameResult.source = DAILY`) affect streaks.

---

## GET `/api/puzzles/archive`

Public paginated list of published `DailyPuzzle` rows excluding today (UTC), newest date first.

```json
{
  "items": [{ "puzzleId": "puzzle-…", "puzzleNumber": 182, "date": "2026-08-20", "playState": "UNPLAYED" }],
  "page": 1,
  "pageSize": 20,
  "total": 12
}
```

`playState` is `UNPLAYED` or `COMPLETED` for the current identity. No title, payload, or article content.

---

## GET `/api/leaderboard/today`

Paginated today's leaderboard. Eligibility is server-side:

- authenticated `userId`
- official
- `source = DAILY`
- won
- `scoreVersion = 1`
- today's `DailyPuzzle`

Order: `score DESC`, `completedAt ASC`. Entries expose `rank`, `displayName`, `avatarUrl`, `score`, and `isCurrentUser` only.

```json
{
  "puzzleNumber": 183,
  "date": "2026-08-21",
  "page": 1,
  "pageSize": 20,
  "total": 2,
  "authenticated": true,
  "played": true,
  "me": { "rank": 1, "score": 9842 },
  "entries": [{ "rank": 1, "displayName": "Alex", "avatarUrl": null, "score": 9842, "isCurrentUser": true }]
}
```

Anonymous gameplay remains allowed; anonymous results never appear. Client cannot submit score, rank, or completion timestamp.

---

## GET `/api/puzzles/archive/:id`

Safe `PublicPuzzleDto` for any published daily assignment (including today, so share links work), plus `officialResult` for the current User or anonymous session when one exists.

---

## GET `/api/me/history`

Requires a signed-in User. Official results only, newest first, paginated. Includes date, puzzle number, `source` (`DAILY` | `ARCHIVE`), result, guess count, and duration. Replays are omitted.

---

## PATCH `/api/me/profile`

Requires a signed-in User. Updates `displayName` only.

---

## POST `/api/auth/email/verify`

Consumes a single-use hashed verification token and sets `emailVerifiedAt`.

## POST `/api/auth/email/resend`

Authenticated. Always returns `{ ok: true }`. While verification mail is disabled this does not send email.

## POST `/api/auth/password/forgot`

Always returns a generic message. Sends a reset email only when an email/password account exists.

## POST `/api/auth/password/reset`

Sets a new password, marks the token used, and detaches `userId` from every Session for that user.

## POST `/api/me/password/change`

Requires current + new password. `400 NO_PASSWORD` for Google-only accounts.

## DELETE `/api/me`

Requires `{ "confirm": "DELETE" }` and the current password when the account has one. Deletes the User, identities, tokens, and that user's `GameResult` rows. Shared Puzzle / DailyPuzzle / Article rows stay.

---

## POST `/api/admin/articles/import`

Requires authenticated `ADMIN`. Import a Wikipedia article into PostgreSQL. Does **not** generate a puzzle.

**Request**

```json
{
  "url": "https://en.wikipedia.org/wiki/Pet_door"
}
```

A raw MediaWiki URL is also accepted and identifies the same article:

```json
{
  "url": "https://en.wikipedia.org/w/index.php?title=Pet_door&action=raw"
}
```

**Response `200`**

```json
{
  "status": "IMPORTED",
  "article": {
    "id": "...",
    "externalId": "wikipedia:en:Pet_door",
    "title": "Pet door",
    "source": "WIKIPEDIA",
    "sourceUrl": "https://en.wikipedia.org/wiki/Pet_door",
    "revisionId": "123456789",
    "language": "en",
    "wordCount": 42,
    "createdAt": "2026-08-13T00:00:00.000Z"
  }
}
```

`status` is `IMPORTED` or `ALREADY_EXISTS`. If the article already exists, Wikipedia is not called.

Does **not** return `rawContent` or `sourceWikitext`.

**Errors** (`{ error: { code, message } }`)

| Code | Status |
|---|---|
| `INVALID_REQUEST` | 400 |
| `VALIDATION_ERROR` | 400 |
| `NOT_FOUND` | 404 |
| `WIKIPEDIA_ERROR` | 502 |
| `IMPORT_ERROR` | 500 |

```bash
curl -X POST http://localhost:4000/api/admin/articles/import \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://en.wikipedia.org/wiki/Pet_door"}'
```

---

## GET `/api/admin/articles`

Paginated article metadata for the admin list. Never returns article bodies.

```bash
curl 'http://localhost:4000/api/admin/articles?page=1&pageSize=20'
```

**Response `200`**

```json
{
  "items": [
    {
      "id": "...",
      "externalId": "wikipedia:en:Pet_door",
      "title": "Pet door",
      "source": "WIKIPEDIA",
      "sourceUrl": "https://en.wikipedia.org/wiki/Pet_door",
      "revisionId": "123456789",
      "language": "en",
      "wordCount": 42,
      "createdAt": "2026-08-13T00:00:00.000Z"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 1
}
```

---

## GET `/api/admin/articles/:articleId/puzzle`

Generate an opaque public puzzle from a stored article for admin preview.

`:articleId` may be the database primary key (`id`) or `externalId` (for example `article-ada-lovelace`, `local:ada-lovelace`, or `wikipedia:en:Pinocchio`).

Does **not** persist a `Puzzle` row and does **not** change today's published puzzle. Completions from this payload must not be sent to `/api/games/complete` (that endpoint requires a real puzzle id).

**Response `200`** — same shape as `GET /api/puzzles/today`

```json
{
  "id": "admin-play-article-ada-lovelace",
  "puzzleNumber": 0,
  "scheduledDate": "2026-08-13",
  "generatorVersion": "1.0.0",
  "payload": "OPAQUE_BASE64URL_PAYLOAD"
}
```

Does **not** return `rawContent`, `title`, or decoded tokens.

**Errors**

| Code | Status |
|---|---|
| `INVALID_REQUEST` | 400 |
| `ARTICLE_NOT_FOUND` | 404 |
| `PUZZLE_GENERATION_FAILED` | 400 |

```bash
curl 'http://localhost:4000/api/admin/articles/article-ada-lovelace/puzzle'
curl 'http://localhost:4000/api/admin/articles/local%3Aada-lovelace/puzzle'
```

---

## GET `/api/admin/puzzles`

Paginated puzzle pool metadata. Never returns payloads or article bodies.

```bash
curl 'http://localhost:4000/api/admin/puzzles?page=1&pageSize=20'
```

---

## POST `/api/admin/puzzles/generate`

Generate a READY puzzle from a stored article using the same generator as admin play / CLI.

**Request**

```json
{
  "articleId": "article-ada-lovelace",
  "force": false
}
```

**Response `200`** — `status` is `GENERATED`, `ALREADY_EXISTS`, `REJECTED`, or `FAILED`.

`--force` / `"force": true` regenerates READY/DRAFT only. Published puzzles are never overwritten.

---

## POST `/api/admin/puzzles/validate`

Re-validate persisted compact payloads (decode + simulated title win). Does not call Wikipedia.

---

## POST `/api/admin/puzzles/publish-today`

Idempotent daily publish: if `DailyPuzzle` exists for UTC today, return it; otherwise select a **random** unused READY puzzle, re-validate it, skip invalids, and assign it.

**Response `200`**

```json
{
  "status": "PUBLISHED",
  "date": "2026-08-20",
  "puzzleId": "puzzle-article-ada-lovelace-2-0-0",
  "puzzleNumber": 1,
  "title": "Ada Lovelace"
}
```

`status` is `PUBLISHED`, `ALREADY_PUBLISHED`, or `NO_CANDIDATE`.

---

## GET `/api/dossiers`

Published dossiers only. Metadata + `caseCount`. No puzzle payloads.

## GET `/api/dossiers/:slug`

Case files: `id`, `position`, `title`, `puzzleId`, `playState` (`SOLVED` / `UNSOLVED` from official wins). No article plaintext.

## GET `/api/dossiers/:slug/cases/:caseId`

Same opaque public puzzle DTO + `officialResult` as archive. 404 unless the dossier is `PUBLISHED`.

## Admin dossiers and corpus

`/api/admin/dossiers*` and `POST /api/admin/corpus` require `role = ADMIN`.

`GET /api/admin/puzzles/pool-stats` returns unused READY / used-in-daily / dossier-linked counts and `lowPool`.

---

## Explicitly not provided

```
POST /api/guess
POST /api/check-word
POST /api/reveal-word
POST /api/check-answer
```
