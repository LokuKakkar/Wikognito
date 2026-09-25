# Architecture Overview

Public product name: **Wikognito**. Short production summary: [docs/architecture.md](../architecture.md). What exists today: [docs/what-is-built.md](../what-is-built.md).

Production is two Render web services plus Render Postgres and Render Key Value. Origins: `https://wikognito.onrender.com` and `https://wikognito-api.onrender.com`. One API process, one frontend, one Postgres, one Redis.

## Components

```text
Article Sources
      │
      ├── LOCAL dummy dataset
      └── Wikipedia import (corpus)
              │
              ▼
     Article Provider / Import Service
              │
              ▼
         PostgreSQL Articles
              │
              ▼
     Puzzle Generator (stored Article only)
              │
              ▼
     Puzzle Validator (compact + simulated title win)
              │
         REJECT / READY pool
              │
              ▼
     publishDailyPuzzle → DailyPuzzle + PUBLISHED Puzzle
              │
              ▼
     Redis cache  redactle:puzzle:v2:today:{YYYY-MM-DD}
              │
              ▼
Backend API (Fastify)  ←→  Redis (gameplay sessions + public puzzle cache)
              │
              ▼
        PostgreSQL Users / Sessions / GameResults
              │
              ▼
        Next.js Frontend
  decode → applyPlayDifficulty → local game engine → localStorage
  Sign in with Google or email (optional)
  /profile → authenticated official statistics
  /archive → public DailyPuzzle history
  /history → private official results
  /settings → profile + password + deletion
  /admin/* → ADMIN only
```

Wikipedia is an article source, not a gameplay dependency. `/api/puzzles/today` never publishes; it reads `DailyPuzzle` for the UTC date.

## Article → Puzzle pipeline

```text
Article (PostgreSQL)
    ↓
same tokenizer for title and body
    ↓
common-word classification (COMMON_VISIBLE_WORDS)
    ↓
titleTokenIds = non-common title match keys (all stream occurrences)
    ↓
CompactPuzzleV2 + opaque payload
    ↓
validate (decode, indexes, simulate WON)
    ↓
READY Puzzle row  (or reject, no persist)
```

Generation does not call Wikipedia. `generatorVersion` (default `2.0.0`) identifies the tokenizer / common-word / compact rules. Changing those rules requires a new version; published puzzles are not rewritten.

## Tokenizer rules

- A word token is a contiguous `[A-Za-z0-9]+` run.
- Whitespace, punctuation, symbols, apostrophes (ASCII and Unicode), and hyphens are visible boundaries.
- Numbers are guessable (`Apollo 11` hides `11` until guessed).
- Common words are always visible, including in titles (`The Lord of the Rings` starts as `The ████ of the █████`).
- Win condition: reveal every required non-common title token (`Lord` + `Rings`).

## Puzzle statuses

| Status | Meaning |
|---|---|
| `DRAFT` | Schema default; not used on the happy path |
| `READY` | Validated and eligible for daily selection |
| `PUBLISHED` | Assigned as an official daily puzzle (immutable gameplay payload) |
| `ARCHIVED` | No longer eligible |

`DailyPuzzle` (`date` → `puzzleId`) is the source of truth for which puzzle is served on a date. Daily selection picks the oldest READY puzzle whose article has not already been used for a published daily.

## Article import

```text
Wikipedia URL
    ↓
URL normalizer → wikipedia:<lang>:<Normalized_Title>
    ↓
PostgreSQL lookup by externalId
    ├── exists → ALREADY_EXISTS (no Wikipedia request)
    └── missing
           ↓
       WikipediaArticleProvider (MediaWiki API)
           ↓
       wikitext → plaintext
           ↓
       persist Article only (no puzzle)
```

`rawContent` remains **normalized plaintext** for puzzle generation. Original MediaWiki source is stored separately in `sourceWikitext`. `contentHash` is SHA-256 of `rawContent`.

`/api/admin/*` requires an authenticated User with `role = ADMIN`. Frontend `/admin` redirects non-admins home; the API is the security boundary. CLI import still works without a browser session.

The frontend never calls Wikipedia. CLI and `POST /api/admin/articles/import` share `importWikipediaArticle`.

Admin play generates a puzzle from a stored article's `rawContent` on the fly using the same generator. It does not persist a `Puzzle` row and must not replace today's published puzzle. Gameplay APIs still never return `rawContent`.

## Opaque puzzle payload

At generation time:

```text
ClientPuzzle → compact dict/stream → deflate → XOR obfuscate → base64url
```

Publishing restamps `id` / `puzzleNumber` / `scheduledDate` in the compact metadata without changing the token stream.

`GET /api/puzzles/today` returns only:

```text
id, puzzleNumber, scheduledDate, generatorVersion, payload
```

The Network tab must not show a readable hidden-word dictionary.  
Decoding lives in `@redactle/puzzle-engine` (`decodeClientPayload`), not in React components.

This is **not** perfect anti-cheat — only opaque transport.

Redis key: `redactle:puzzle:v2:today:{YYYY-MM-DD}`. PostgreSQL/DailyPuzzle is source of truth; Redis is a 1-hour cache populated on read and on publish.

## Win condition

The game becomes `WON` when every `titleTokenId` is revealed. Those IDs are the guessable (non-common) title words, including body occurrences of the same match keys. Common title words are already visible and are not required.

This is evaluated in the puzzle/game engine, not in UI code.

Play difficulty does not change the stored payload. `applyPlayDifficulty` (default `easy`) reveals extra stopwords on the client before play. Hard uses `COMMON_VISIBLE_WORDS` only. Words opened this way are already visible, so they are not required to win. The official puzzle and score version stay the same.

## Terminal persistence + replay

`GameState` includes `attemptId`, `status`, `completedAt`.

```text
localStorage + Redis session TTL
```

both keep `WON` / `GAVE_UP` across reload/reopen.

Only explicit **Replay** creates a new `attemptId` and resets guesses.  
Previous `GameResult` rows remain. For a signed-in User there is at most one official result per puzzle; replays are `isOfficial: false` and do not affect statistics.  
`GameResult.source` is `DAILY` when the completed puzzle is today's DailyPuzzle (server clock) and `ARCHIVE` otherwise. Archive official results update general stats but never streaks.

localStorage keys are per puzzle (`redactle:game:{puzzleId}`) so archive play cannot overwrite today's attempt.

## Identity

```text
HttpOnly cookie UUID
    ↓
Postgres Session (userId nullable)
    ↓
User ← AuthIdentity (GOOGLE | EMAIL)
    ↓
official GameResult.userId + source (DAILY | ARCHIVE)
```

Google login claims the current anonymous session and eligible official results. Email/password register and login do the same using `AuthIdentity(EMAIL, email)`. Logout clears `userId` on that session only and returns the browser to today's puzzle.

## Data ownership

| Data | Owner |
|---|---|
| Full article plaintext / wikitext | PostgreSQL / server only |
| READY / PUBLISHED puzzle payloads | PostgreSQL |
| Daily assignment | PostgreSQL `DailyPuzzle` |
| Opaque public puzzle DTO cache | Redis |
| Active/terminal guesses | Browser localStorage + Redis game session |
| Identity session (cookie → optional User) | PostgreSQL `Session` |
| OAuth mapping | PostgreSQL `AuthIdentity` (`provider` + `providerSubject`) |
| Official completed results / user stats | PostgreSQL `GameResult` + `DailyPuzzle` |

## Request flows

### Puzzle load

```text
Frontend → GET /api/puzzles/today → Redis → DailyPuzzle → Puzzle → PublicPuzzleDto
Frontend → decodeClientPayload → ClientPuzzle → GameEngine
```

### Guess (no network)

```text
User input → GameEngine → match → reveal → localStorage
```

### Completion

```text
WON / GAVE_UP → POST /api/games/complete → GameResult + Redis terminal session
Authenticated: userId from Session; at most one official row per User + Puzzle
```

### Google sign-in

```text
GET /api/auth/google → Google → callback → User + AuthIdentity
  → claim Session + eligible GameResults → redirect frontend
```

### Article import

```text
Frontend / CLI → import service → URL normalizer → DB lookup
  → Wikipedia provider (only if missing) → plaintext conversion → Article row
```

### Generate / publish

```text
CLI / admin → generatePuzzleFromStoredArticle → validate → READY
CLI / admin → publishDailyPuzzle(date) → DailyPuzzle + PUBLISHED + Redis
```

## Payload sizing

`packages/puzzle-engine` includes a benchmark test for small/medium/large articles  
comparing legacy per-token JSON vs compact/compressed/encoded sizes.
