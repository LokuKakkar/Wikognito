# Redactle Clone — System Design & Phase 1 Implementation Plan

## 0. Purpose of This Document

This document is the **source of truth for the initial implementation of the Redactle-like game project**.

It is intended to be passed to Cursor as the project specification.

Cursor must:

1. Understand the complete system architecture before implementing it.
2. Create the repository/folder structure from scratch.
3. Initialize all required projects and packages.
4. Set up local infrastructure.
5. Create configuration and environment-variable templates.
6. Implement the complete Phase 1 MVP described below.
7. Keep boundaries clean so later phases can replace dummy data with real Wikipedia data without requiring a major rewrite.
8. Provide clear commands for running, testing, and inspecting every important part of the system.

Do **not** skip setup work because the current implementation uses dummy data.

The project must be structured as if the real system is already being built, while allowing Phase 1 to use dummy content.

---

# 1. Product Definition

We are building a web-based Redactle-like word deduction game.

The basic gameplay:

1. The server has a full article.
2. The article is transformed into a redacted puzzle.
3. The frontend receives the redacted puzzle.
4. The user guesses words.
5. Word matching and revealing happen **entirely on the client**.
6. Guessing a word must **not** make an API request.
7. The current game state is persisted locally so reloads and closing/reopening the browser do not lose progress.
8. The server also maintains recoverable active-session state in Redis.
9. When the game is completed, the final result is persisted to PostgreSQL.
10. Permanent statistics are derived from completed game results.

The game is intentionally designed so that gameplay does not depend on Wikipedia being available.

---

# 2. Initial Scale

The initial expected scale is deliberately small:

- Registered users: approximately 1,000
- Daily active users: approximately 100
- One backend API server initially
- One frontend deployment initially
- One PostgreSQL instance
- One Redis instance
- No Kubernetes
- No load balancer
- No multiple API servers
- No Kafka
- No message broker
- No Elasticsearch

The architecture must nevertheless have clean boundaries so it can scale later.

Do not prematurely implement distributed infrastructure.

---

# 3. Core Architectural Principle

The system has four major ownership boundaries:

### Browser / Frontend

Owns the active gameplay loop.

The browser is responsible for:

- rendering the redacted article
- receiving guesses
- normalizing guesses
- matching guesses against client-side puzzle matching data
- revealing matching words
- maintaining current gameplay state
- storing local gameplay state
- periodically synchronizing active session state

A guess must NOT call the backend.

### Backend

Owns:

- authentication/session identity
- puzzle delivery
- session recovery
- Redis interaction
- permanent game completion
- statistics
- database interaction
- API contracts

### Redis

Owns ephemeral/recoverable active game sessions and cache data.

Redis is mandatory from V1.

Redis is not being introduced because the current traffic requires it. It is part of the intended session architecture.

### PostgreSQL

Owns durable data:

- users
- articles
- puzzles
- completed game results
- durable statistics if needed

The database must not receive a permanent write for every guess.

---

# 4. Important Security / Client-Side Constraint

The full original article must remain server-side.

The frontend receives the **redacted article representation** and the information required to perform local gameplay.

The frontend must NOT receive the full plaintext article as a normal API field.

However, client-side word matching inherently means the browser must possess some derived representation of the hidden words.

Therefore:

- The full article is never sent as plaintext.
- The browser receives a client-safe puzzle representation.
- The client can determine whether a guess matches.
- This is not intended to provide cryptographically perfect anti-cheat protection.
- A sufficiently technical user can always reverse-engineer a client-side game.
- The objective is to prevent trivial exposure of the full answer/article through the normal API response.

Do not implement server-side guess checking.

Do not create an endpoint such as:

`POST /puzzles/:id/guess`

The frontend must be able to process guesses without making a network request.

---

# 5. Example of the Redacted Article

The frontend should support a representation similar to what the actual Redactle frontend receives:

```html
<p>&lt;section data-mw-section-id="0"&gt;<br />
&lt;p&gt;<br />
&lt;span word-length="14" class="word redacted in-title"&gt;██████████████&lt;/span&gt;<br />
, the &lt;span word-length="6" class="word redacted"&gt;██████&lt;/span&gt;<br />
&lt;span word-length="8" class="word redacted"&gt;████████&lt;/span&gt;<br />
, was the &lt;span word-length="7" class="word redacted"&gt;███████&lt;/span&gt;<br />
of the &lt;span word-length="5" class="word redacted"&gt;█████&lt;/span&gt;<br />
&lt;/p&gt;<br />
&lt;p&gt;<br />
&lt;span word-length="14" class="word redacted in-title"&gt;██████████████&lt;/span&gt;<br />
was &lt;span word-length="7" class="word redacted"&gt;███████&lt;/span&gt;<br />
on the &lt;span word-length="4" class="word redacted"&gt;████&lt;/span&gt;<br />
&lt;/p&gt;<br />
&lt;/section&gt;<br />
&lt;!----&gt;<br />
&lt;/div&gt;<br />
&lt;div style="display: contents;"&gt;<br />
&lt;!----&gt;<br />
&lt;section data-mw-section-id="1"&gt;<br />
&lt;div&gt;<br />
&lt;h2 id="Names"&gt;<br />
&lt;span word-length="5" class="word redacted"&gt;█████&lt;/span&gt;<br />
&lt;/h2&gt;<br />
&lt;/div&gt;<br />
&lt;p&gt;<br />
Before &lt;span word-length="11" class="word redacted"&gt;███████████&lt;/span&gt;<br />
&lt;span word-length="1" class="word redacted"&gt;█&lt;/span&gt;<br />
, the &lt;span word-length="4" class="word redacted"&gt;████&lt;/span&gt;<br />
was &lt;span word-length="5" class="word redacted"&gt;█████&lt;/span&gt;<br />
&lt;/p&gt;
```

The exact internal format may be improved during implementation, but the following properties are required:

- HTML/article structure can be represented.
- Paragraphs/headings/sections can be represented.
- Word boundaries are known.
- Word lengths are known.
- Title words can be identified.
- Hidden words have stable token identities.
- The client can reveal individual word tokens after a successful local guess.

Do not make the frontend manipulate a giant HTML string for every guess.

Parse the puzzle representation into a client-side token model.

---

# 6. Core Domain Model

The initial system should have these conceptual entities.

## 6.1 User

Represents a registered user.

Initial fields:

- id
- createdAt
- updatedAt

Authentication can be minimal/dummy in Phase 1.

Do not spend Phase 1 implementing a full production authentication system.

---

## 6.2 Article

Represents the canonical full article.

Conceptual fields:

- id
- externalId
- title
- source
- sourceUrl
- revisionId
- language
- rawContent
- wordCount
- createdAt
- updatedAt

The full article belongs on the server/database.

It must not be returned to the frontend as part of the gameplay response.

---

## 6.3 Puzzle

Represents a published game puzzle generated from an article.

Conceptual fields:

- id
- articleId
- puzzleNumber
- scheduledDate
- generatorVersion
- clientPuzzleData
- status
- createdAt
- publishedAt

A published puzzle is immutable.

Once a daily puzzle is published, changing the puzzle generation algorithm must not change that already-published puzzle.

---

## 6.4 Game Session

Represents the active attempt by one player on one puzzle.

Active session state belongs in Redis.

Conceptual fields:

- sessionId
- puzzleId
- userId if authenticated
- startedAt
- updatedAt
- status
- guessCount
- guesses

Do not permanently store every guess as a database row.

---

## 6.5 Game Result

Represents the durable outcome of a completed game.

Conceptual fields:

- id
- userId if available
- puzzleId
- startedAt
- completedAt
- duration
- guessCount
- won
- score
- optional result metadata

This is written to PostgreSQL when the game is completed.

---

# 7. Source of Truth by Data Type

| Data | Browser | Redis | PostgreSQL | Server-only |
|---|---:|---:|---:|---:|
| Redacted puzzle | Yes | Optional cache | Yes | |
| Full article | No | No | Yes | Yes |
| Puzzle ID | Yes | Yes | Yes | |
| Client matching data | Yes | Optional | Yes | |
| Current guesses | Yes | Yes | No | |
| Revealed words | Derived locally | Optional | No | |
| Session ID | Cookie | Yes | Optional | |
| Active game | Local + Redis | Yes | No | |
| Completed result | No | Temporary | Yes | |
| User statistics | Displayed | Optional cache | Yes | |
| Wikipedia API credentials | No | No | No | Yes |

---

# 8. Repository / Monorepo Structure

Use a single monorepo initially.

Do NOT split into multiple Git repositories unless there is a concrete reason later.

The logical applications/services must still be separated.

Recommended structure:

```text
redactle/
│
├── apps/
│   ├── frontend/
│   │   ├── app/
│   │   ├── components/
│   │   ├── features/
│   │   │   └── game/
│   │   ├── lib/
│   │   ├── public/
│   │   ├── tests/
│   │   └── package.json
│   │
│   └── backend/
│       ├── src/
│       │   ├── modules/
│       │   │   ├── puzzles/
│       │   │   ├── sessions/
│       │   │   ├── games/
│       │   │   ├── stats/
│       │   │   └── users/
│       │   ├── infrastructure/
│       │   │   ├── postgres/
│       │   │   ├── redis/
│       │   │   └── config/
│       │   ├── routes/
│       │   └── server.ts
│       └── package.json
│
├── services/
│   ├── article-provider/
│   │   ├── src/
│   │   │   ├── providers/
│   │   │   │   ├── local/
│   │   │   │   └── wikipedia/
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── article-ingestion/
│       ├── src/
│       │   ├── parser/
│       │   ├── tokenizer/
│       │   ├── redactor/
│       │   ├── validator/
│       │   └── pipeline/
│       └── package.json
│
├── packages/
│   ├── puzzle-engine/
│   │   ├── src/
│   │   │   ├── tokenizer/
│   │   │   ├── matcher/
│   │   │   ├── normalizer/
│   │   │   ├── models/
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── shared/
│   │   ├── src/
│   │   │   ├── types/
│   │   │   ├── schemas/
│   │   │   ├── constants/
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── test-utils/
│       ├── src/
│       └── package.json
│
├── infrastructure/
│   ├── docker/
│   │   └── docker-compose.yml
│   └── database/
│       ├── migrations/
│       └── seed/
│
├── docs/
│   ├── architecture/
│   └── api/
│
├── scripts/
│
├── .env.example
├── .gitignore
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.json
├── README.md
└── PROJECT_PLAN.md
```

The exact folder names may be adjusted slightly if the chosen libraries require it, but the boundaries must remain.

---

# 9. Technology Stack

Use:

## Frontend

- Next.js
- TypeScript
- React
- App Router

## Backend

- Node.js
- TypeScript
- Fastify

## Database

- PostgreSQL
- Prisma ORM

## Cache / Session

- Redis
- `ioredis`

## Package management

- pnpm workspaces

## Testing

- Vitest
- React Testing Library for frontend component tests where appropriate
- Supertest or Fastify's built-in injection facilities for backend API tests

## Local infrastructure

- Docker Compose
- PostgreSQL container
- Redis container

Do not introduce Kubernetes.

---

# 10. Environment Configuration

Create `.env.example` files and never commit real credentials.

The project must start with the user explicitly filling in the required values.

At minimum define:

```env
NODE_ENV=development

DATABASE_URL=

REDIS_URL=

BACKEND_PORT=4000

NEXT_PUBLIC_API_BASE_URL=http://localhost:4000

SESSION_COOKIE_NAME=redactle_session

SESSION_TTL_SECONDS=2592000

ARTICLE_SOURCE=LOCAL

WIKIPEDIA_API_URL=

PUZZLE_GENERATOR_VERSION=1.0.0
```

The implementation should clearly identify which variables are:

- required
- optional
- only needed for future phases

If a variable is intentionally empty in Phase 1, explain why.

The application should fail with a clear configuration error rather than an obscure runtime error when a required environment variable is missing.

Never hard-code:

- database credentials
- Redis credentials
- API keys
- secrets

---

# 11. Local Infrastructure

Create Docker Compose for:

```text
PostgreSQL
Redis
```

The project should support:

```bash
docker compose -f infrastructure/docker/docker-compose.yml up -d
```

and:

```bash
docker compose -f infrastructure/docker/docker-compose.yml down
```

The frontend and backend can run directly from pnpm during development.

Later, Dockerizing the application services is optional.

---

# 12. Phase 1 Goal

Phase 1 is the **first complete working MVP**.

It must be possible to:

1. Start PostgreSQL.
2. Start Redis.
3. Start the backend.
4. Start the frontend.
5. Open the game in a browser.
6. Receive a dummy daily puzzle.
7. See a redacted article.
8. Enter guesses.
9. Have guesses processed entirely on the client.
10. Reveal matching words locally.
11. Persist game state locally.
12. Reload the page and retain progress.
13. Close and reopen the browser and retain progress.
14. Synchronize active session state to Redis.
15. Complete the game.
16. Persist a GameResult to PostgreSQL.
17. Retrieve basic statistics.
18. Run automated tests.
19. Run individual backend methods/services directly for testing.
20. Run the whole system with documented commands.

The first MVP may use dummy data.

Do NOT wait for real Wikipedia ingestion before completing the MVP.

---

# 13. Phase 1 Dummy Article

Use a small deterministic article.

For example:

```text
Ada Lovelace was an English mathematician and writer.
She is known for her work on the Analytical Engine.
Her notes described an algorithm that could be processed by a machine.
```

Use a known answer/title such as:

```text
Ada Lovelace
```

The dummy article should be processed through the same pipeline intended for real articles.

Do not hard-code a fake already-redacted HTML blob as the only implementation.

The point of Phase 1 is to prove:

```text
Raw article
    ↓
Pipeline
    ↓
Puzzle representation
    ↓
Frontend
    ↓
Local matching
    ↓
Reveal
```

---

# 14. Article Pipeline

The article pipeline is a core architectural component.

It must be independent of the HTTP request lifecycle.

Pipeline:

```text
Article Source
      ↓
Fetch
      ↓
Parse
      ↓
Normalize
      ↓
Tokenize
      ↓
Determine redactable words
      ↓
Generate redacted representation
      ↓
Generate client matching representation
      ↓
Validate
      ↓
Create Puzzle
      ↓
Persist
```

---

# 15. Article Provider Abstraction

Create an interface similar to:

```ts
interface ArticleProvider {
  getArticleById(id: string): Promise<Article>;
  getArticles(options?: GetArticlesOptions): Promise<Article[]>;
}
```

Implement:

```text
LocalArticleProvider
WikipediaArticleProvider
```

Phase 1 uses:

```env
ARTICLE_SOURCE=LOCAL
```

The backend/application must not contain Wikipedia-specific logic.

Wikipedia-specific behavior belongs in the article-provider service.

---

# 16. Future Wikipedia Modes

The architecture must support two future modes.

## Mode A — Preloaded Dataset

Initial preferred mode.

```text
Wikipedia dataset
        ↓
Import
        ↓
PostgreSQL
        ↓
ArticleProvider
```

Potentially support:

- 1,000 articles initially
- 10,000 articles later

Gameplay must not make Wikipedia requests.

## Mode B — Daily External Fetch

Later:

```text
Scheduler
   ↓
WikipediaArticleProvider
   ↓
Fetch article
   ↓
Article ingestion pipeline
   ↓
Generate puzzle
   ↓
PostgreSQL
   ↓
Publish
```

Configuration:

```env
ARTICLE_SOURCE=WIKIPEDIA
```

The rest of the application must not change.

---

# 17. Puzzle Generation

The puzzle generator must produce:

1. A redacted display representation.
2. Token metadata.
3. Client-side matching information.
4. The original answer/title server-side.
5. Generator version.

Example conceptual internal representation:

```ts
interface PuzzleToken {
  tokenId: string;
  type: "word" | "text" | "punctuation" | "whitespace";
  wordLength?: number;
  inTitle?: boolean;
  redacted?: boolean;
  matchKey?: string;
  displayValue?: string;
}
```

Do not expose `displayValue` for hidden words if it would reveal the answer.

The exact client payload may have separate public and private representations.

---

# 18. Puzzle Client Payload

The public puzzle payload should contain enough information for the frontend to render and play.

Conceptually:

```ts
interface ClientPuzzle {
  puzzleId: string;
  puzzleNumber: number;
  scheduledDate: string;
  generatorVersion: string;
  content: ClientPuzzleToken[];
}
```

A client token can contain:

```ts
interface ClientPuzzleToken {
  tokenId: string;
  type: "word" | "text" | "punctuation" | "whitespace";
  wordLength?: number;
  inTitle?: boolean;
  redacted?: boolean;
  displayValue?: string;
  matchKey?: string;
}
```

The implementation must carefully distinguish between:

- content that is safe to expose
- content that would reveal the answer

Do not return the full article from the puzzle endpoint.

---

# 19. Local Game Engine

Create a dedicated frontend game-engine module.

It should not be mixed into React components.

React should render state produced by the game engine.

Responsibilities:

- normalize guess
- deduplicate guesses
- match guess against puzzle data
- identify matching token IDs
- reveal matched tokens
- calculate hit count
- determine whether the game is won
- calculate progress
- serialize/deserialize game state

Conceptual interface:

```ts
interface GameState {
  puzzleId: string;
  guesses: string[];
  startedAt: number;
  status: "IN_PROGRESS" | "WON" | "GAVE_UP";
}
```

And:

```ts
interface GuessResult {
  normalizedGuess: string;
  hitCount: number;
  matchedTokenIds: string[];
  isCorrect: boolean;
  gameCompleted: boolean;
}
```

The game engine must be deterministic.

Given:

```text
same puzzle
+
same guesses
```

it must always produce:

```text
same revealed tokens
+
same hit counts
+
same game status
```

---

# 20. Guess Processing

The flow must be:

```text
User enters guess
      ↓
Frontend Game Engine
      ↓
Normalize
      ↓
Check duplicate
      ↓
Match locally
      ↓
Calculate hits
      ↓
Update local GameState
      ↓
Persist local state
      ↓
Render
```

There must be no API request in this path.

Do not implement:

```text
POST /guess
```

---

# 21. Guess Normalization

Create a dedicated normalizer.

At minimum:

- trim whitespace
- normalize casing
- reject empty guesses
- collapse unnecessary whitespace
- define behavior for punctuation

For Phase 1 use straightforward exact normalized matching.

Do not implement sophisticated lemmatization in Phase 1.

Future smart matching can be added later.

---

# 22. Duplicate Guesses

A duplicate guess must not create a new game action.

Example:

```text
physics
physics
```

The second guess should be identified as already guessed.

The UI should make this obvious.

---

# 23. Local Persistence

Do not use `sessionStorage` as the primary persistence mechanism.

`sessionStorage` is tab-scoped and does not satisfy the requirement to survive closing the tab.

Use:

```text
localStorage
```

for browser-side game persistence.

Store a compact state such as:

```json
{
  "puzzleId": "183",
  "guesses": [
    "science",
    "physics"
  ],
  "startedAt": 1786530000000
}
```

Do not store a giant rendered HTML snapshot.

The current UI must be derived from:

```text
Puzzle
+
GameState
```

---

# 24. Session Cookie

Use a cookie containing a server-side session identifier.

Example conceptually:

```text
redactle_session=<opaque-id>
```

The cookie should be:

- HttpOnly where possible
- Secure in production
- SameSite appropriately configured
- not contain the full game state
- not contain the answer

The backend uses the session ID to locate Redis state.

---

# 25. Redis Active Session

Use Redis key names with a clear namespace.

Example:

```text
redactle:session:<sessionId>
```

Store:

```json
{
  "puzzleId": "183",
  "userId": null,
  "status": "IN_PROGRESS",
  "guesses": [
    "science",
    "physics"
  ],
  "startedAt": 1786530000000,
  "updatedAt": 1786531000000
}
```

Use a TTL.

Initial recommended TTL:

```text
30 days
```

Make this configurable:

```env
SESSION_TTL_SECONDS=2592000
```

---

# 26. Session Synchronization

The browser does not synchronize every guess.

Implement a session-sync mechanism.

Possible triggers:

- initial session creation
- periodic background sync
- page visibility changes
- before page unload where appropriate
- game completion

Do not rely exclusively on `beforeunload`, because browsers do not guarantee arbitrary asynchronous requests during page unload.

The frontend should periodically synchronize enough state to Redis.

The sync payload should contain the current authoritative browser game state, for example:

```json
{
  "puzzleId": "183",
  "status": "IN_PROGRESS",
  "guesses": [
    "science",
    "physics"
  ],
  "startedAt": 1786530000000
}
```

The backend validates that the puzzle/session combination is valid before storing it.

---

# 27. Session Recovery

On page load:

```text
1. Fetch today's puzzle.
2. Read localStorage.
3. If localStorage contains the same puzzle ID:
      restore it immediately.
4. Otherwise attempt server-session recovery.
5. If Redis has active state:
      restore that state.
6. Otherwise start a new game.
```

Do not allow an old puzzle's guesses to be applied to a new puzzle.

---

# 28. Completed Game Flow

When the local game engine determines:

```text
WON
```

or:

```text
GAVE_UP
```

the frontend calls:

```text
POST /api/games/complete
```

This is allowed because it is a game-state transition, not a guess lookup.

The backend:

1. Validates the session.
2. Validates the puzzle.
3. Validates that the game is not already completed.
4. Creates a durable GameResult.
5. Updates/invalidates Redis session state.
6. Returns the final result.

The operation must be idempotent.

If the frontend accidentally sends completion twice, the user must not get two permanent game results.

---

# 29. API Endpoints for Phase 1

Implement only the APIs that are actually needed.

## GET `/api/health`

Returns:

```json
{
  "status": "ok"
}
```

Also provide a deeper health check if practical:

```text
GET /api/health/dependencies
```

checking:

- PostgreSQL
- Redis

---

## GET `/api/puzzles/today`

Returns the public/client-safe puzzle.

Must NOT return:

- full article
- plaintext answer
- server-only article fields

Example:

```json
{
  "id": "183",
  "puzzleNumber": 183,
  "scheduledDate": "2026-08-13",
  "generatorVersion": "1.0.0",
  "content": []
}
```

---

## GET `/api/sessions/current`

Returns recoverable session state if one exists.

If there is no active session:

```text
204 No Content
```

or an equivalent explicit response.

---

## POST `/api/sessions/sync`

Stores the active local game state in Redis.

This endpoint does NOT process a guess.

---

## POST `/api/games/complete`

Creates a durable GameResult.

---

## GET `/api/stats`

Returns basic statistics for the current authenticated/identified user.

For Phase 1 this can be minimal.

---

# 30. Do Not Create These APIs

Do not create:

```text
POST /api/guess
POST /api/check-word
POST /api/reveal-word
POST /api/check-answer
```

Gameplay must remain client-side.

---

# 31. Backend Module Structure

Use clear module boundaries.

Example:

```text
backend/src/modules/
│
├── puzzles/
│   ├── puzzle.controller.ts
│   ├── puzzle.service.ts
│   ├── puzzle.repository.ts
│   └── puzzle.types.ts
│
├── sessions/
│   ├── session.controller.ts
│   ├── session.service.ts
│   ├── session.repository.ts
│   └── session.types.ts
│
├── games/
│   ├── game.controller.ts
│   ├── game.service.ts
│   ├── game.repository.ts
│   └── game.types.ts
│
└── stats/
    ├── stats.controller.ts
    ├── stats.service.ts
    └── stats.repository.ts
```

Controllers/routes should not contain business logic.

The expected flow is:

```text
Route/Controller
      ↓
Service
      ↓
Repository
      ↓
Database / Redis
```

---

# 32. Puzzle Engine Structure

Keep the puzzle engine independent from Fastify and Next.js.

It should be usable from tests or a standalone script.

Example:

```text
packages/puzzle-engine/src/
│
├── models/
│   ├── article.ts
│   ├── token.ts
│   └── puzzle.ts
│
├── normalizer/
│   └── word-normalizer.ts
│
├── tokenizer/
│   └── tokenizer.ts
│
├── matcher/
│   └── matcher.ts
│
├── redactor/
│   └── redactor.ts
│
├── generator/
│   └── puzzle-generator.ts
│
└── index.ts
```

---

# 33. Article Ingestion Service

The ingestion service must be runnable without the web application.

Create a CLI such as:

```bash
pnpm --filter article-ingestion ingest:dummy
```

Later:

```bash
pnpm --filter article-ingestion ingest:local
```

and eventually:

```bash
pnpm --filter article-ingestion ingest:wikipedia
```

The exact command names can be adjusted, but there must be simple documented commands.

---

# 34. Phase 1 Ingestion

Phase 1 must:

1. Load the dummy article.
2. Pass it through the article provider.
3. Process it through the ingestion pipeline.
4. Generate a puzzle.
5. Persist the article.
6. Persist the puzzle.
7. Mark the puzzle as published/current.

Do not manually insert an already-built puzzle into PostgreSQL and call the MVP complete.

The pipeline itself must be exercised.

---

# 35. Database Schema

Create Prisma schema/models for at least:

```text
User
Article
Puzzle
GameResult
```

Do not create a permanent `Guess` table in Phase 1.

Active guesses live in:

```text
browser localStorage
+
Redis session
```

If historical guess-by-guess analytics become necessary later, a separate design can be introduced.

---

# 36. Database Rules

Use migrations.

Do not rely on:

```bash
prisma db push
```

as the primary schema-management mechanism.

Use proper migrations for the project.

The README must document:

```bash
pnpm prisma migrate dev
```

or the corresponding workspace command.

Seed data must be deterministic.

---

# 37. Redis Rules

Create a dedicated Redis repository/service abstraction.

Do not scatter raw Redis calls throughout the backend.

Bad:

```ts
redis.set(...)
```

inside random controllers.

Prefer:

```text
SessionService
    ↓
SessionRepository
    ↓
Redis
```

This keeps the implementation replaceable and testable.

---

# 38. Cache Strategy

Redis serves two purposes in V1:

## 1. Active session state

Primary requirement.

## 2. Puzzle caching

Optional but recommended.

Example:

```text
redactle:puzzle:today
```

The backend can first check Redis.

On miss:

```text
Redis
 ↓
PostgreSQL
 ↓
Redis
```

This reduces repeated DB reads.

The cache must never be the only source of truth for published puzzles.

---

# 39. Error Handling

Define consistent API errors.

Example:

```json
{
  "error": {
    "code": "PUZZLE_NOT_FOUND",
    "message": "Today's puzzle could not be found."
  }
}
```

Do not leak:

- database connection details
- stack traces
- internal file paths
- Redis errors
- secrets

in production responses.

In development, log useful diagnostics.

---

# 40. Logging

Create structured logging in the backend.

At minimum log:

- startup
- shutdown
- request method/path/status
- important errors
- database connection status
- Redis connection status
- puzzle publication
- game completion

Do not log:

- session cookies
- secrets
- passwords
- full article content
- unnecessary personal data

---

# 41. Testing Requirements

The project must be easy to test.

Do not rely exclusively on manually opening the browser.

There must be unit tests for:

### Puzzle engine

- normalization
- tokenization
- redaction
- matching
- duplicate guesses
- hit counts
- title detection
- game completion
- serialization/deserialization

### Backend

- health endpoint
- today's puzzle endpoint
- session creation/recovery
- session synchronization
- game completion
- duplicate completion/idempotency
- stats endpoint

### Frontend

At least test:

- initial puzzle rendering
- submitting a guess
- revealing matching words
- duplicate guess behavior
- reload/recovery behavior
- win state

---

# 42. Test the Game Engine Without React

This is particularly important.

There should be a simple test like:

```ts
const game = createGame(dummyPuzzle);

const result = game.guess("physics");

expect(result.hitCount).toBe(1);
expect(result.gameCompleted).toBe(false);
```

And:

```ts
const result = game.guess("ada");

expect(result.hitCount).toBeGreaterThan(0);
```

The exact dummy values should be deterministic.

The game engine must be testable as a pure library.

---

# 43. Add a Developer CLI for Testing

Create scripts that make development easy.

For example:

```bash
pnpm dev
pnpm test
pnpm test:watch
pnpm lint
pnpm typecheck
pnpm db:migrate
pnpm db:seed
pnpm db:reset
pnpm redis:clear
```

Also provide targeted commands:

```bash
pnpm test:puzzle-engine
pnpm test:backend
pnpm test:frontend
```

The exact implementation is flexible, but the final README must document the actual commands.

---

# 44. Manual API Testing

Provide an easy way to test APIs without requiring the frontend.

Use one of:

- curl examples in `docs/api/`
- an HTTP client collection
- scripts

At minimum document:

```bash
curl http://localhost:4000/api/health
```

and:

```bash
curl http://localhost:4000/api/puzzles/today
```

For session endpoints, document how to preserve cookies.

Do not require the developer to guess how to test the backend.

---

# 45. Seed Data

Provide a deterministic seed command.

Example:

```bash
pnpm db:seed
```

It should create:

- one dummy user if needed
- one dummy article
- one published puzzle

Running the seed repeatedly should not create unlimited duplicates.

Use stable identifiers or upsert behavior.

---

# 46. Frontend Development Behavior

The frontend should:

1. Load the puzzle.
2. Parse/build the client puzzle model.
3. Load local game state.
4. Validate the stored puzzle ID.
5. Restore state if applicable.
6. Render the game.
7. Process guesses locally.
8. Persist state locally.
9. Synchronize periodically.
10. Complete the game when appropriate.

The UI should not contain database/session business logic.

Create hooks/services such as:

```text
useGame()
usePuzzle()
useSessionSync()
```

where appropriate.

---

# 47. Frontend Component Boundaries

At minimum create conceptual components for:

```text
GamePage
PuzzleArticle
PuzzleToken
GuessInput
GuessHistory
GameStats
GameStatus
```

Do not create one giant component.

The article renderer should receive a game/puzzle state and render it.

---

# 48. MVP UI

The MVP does not need to look polished.

It must have:

- title/header
- puzzle article
- guess input
- guess button
- guess history
- hit counts
- game status
- give-up option
- reset/new game behavior where appropriate
- basic statistics/result screen

Do not spend Phase 1 time on animations, advanced styling, SEO, ads, social sharing, or advanced authentication.

---

# 49. MVP Win Condition

Implement a clear win condition.

For Phase 1 use:

```text
User explicitly guesses the puzzle title
```

or the defined equivalent in the game engine.

Do not depend on the frontend simply revealing title words unless the engine explicitly defines that as the rule.

The rule must be centralized in the puzzle/game engine, not scattered through UI components.

---

# 50. Give Up

Implement:

```text
Give Up
```

as a terminal state.

The frontend may reveal the answer after confirmation.

The backend should receive the final result when the game ends.

---

# 51. Daily Puzzle in Phase 1

Phase 1 does not need a real scheduler.

Create a deterministic "today's puzzle" service.

For example:

```text
current date
    ↓
find published puzzle for date
```

The seed script can create today's dummy puzzle.

Later phases can introduce:

- article selection
- scheduled ingestion
- automated publication
- daily Wikipedia API calls

The API contract must not need to change.

---

# 52. Published Puzzle Immutability

Once a puzzle is published:

- do not mutate its article content
- do not mutate its client puzzle representation
- do not regenerate it on every request
- do not change it when the generator code changes

Store:

```text
generatorVersion
```

on the puzzle.

---

# 53. Performance Requirements for Phase 1

Do not optimize prematurely, but maintain the intended architecture.

The gameplay path should be:

```text
guess
 ↓
local computation
 ↓
React state update
```

No network dependency.

Initial puzzle load:

```text
frontend
 ↓
backend
 ↓
Redis cache
 ↓
PostgreSQL fallback
```

should be fast enough for normal development.

---

# 54. No Multiple API Servers Yet

The backend must be stateless enough that multiple instances could be introduced later, but Phase 1 runs exactly one backend instance.

Do not implement:

- load balancing
- service discovery
- horizontal autoscaling
- Kubernetes
- container orchestration beyond local Docker Compose dependencies

The backend must rely on:

```text
Redis
PostgreSQL
```

for shared state rather than process memory.

---

# 55. Future Scaling Direction

The architecture should eventually support:

```text
                 Load Balancer
                /      |      \
             API      API      API
                \      |      /
                    Redis
                      |
                  PostgreSQL
```

But this is future architecture only.

The Phase 1 implementation must not add unnecessary infrastructure for it.

---

# 56. Failure Scenarios

The implementation should handle at least these scenarios gracefully.

## Redis unavailable

Backend should clearly report dependency failure.

Do not silently pretend the session was persisted.

## PostgreSQL unavailable

Health endpoint should indicate failure.

Puzzle endpoint should fail clearly if the puzzle cannot be obtained.

## Redis session missing

Try local browser state first.

If no local state exists, start/recover appropriately.

## LocalStorage corrupted

Discard invalid local state and recover from server session if available.

## Local state belongs to another puzzle

Do not apply it.

## Duplicate game completion

Must be idempotent.

## Duplicate guesses

Must not affect score/hit count twice.

---

# 57. Phase 1 Does NOT Include

Do not implement these yet:

- Real Wikipedia ingestion
- 1,000/10,000 article import
- Wikipedia scheduling
- smart lemmatization
- AI
- multiplayer
- leaderboards
- social sharing
- advanced authentication
- email login
- OAuth
- payments
- advertisements
- multiple API servers
- Kubernetes
- CI/CD deployment automation
- advanced analytics
- production-grade anti-cheat
- sophisticated difficulty ranking

The architecture must make these possible later, but Phase 1 should not implement them.

---

# 58. Future Phase Roadmap

The project will be developed in phases.

Each future phase gets its own plan.

## Phase 1 — Complete MVP

Implement everything described in this document using dummy data.

## Phase 2 — Real Article Ingestion

Implement:

- real Wikipedia provider
- local article dataset import
- 1,000+ articles
- article validation
- real puzzle generation

## Phase 3 — Daily Puzzle System

Implement:

- puzzle selection
- scheduled generation
- publication
- deterministic daily puzzles
- generator versioning

## Phase 4 — Accounts and Statistics

Implement:

- real authentication
- user profiles
- durable statistics
- streaks
- historical games

## Phase 5 — Puzzle Quality

Implement:

- article filtering
- difficulty estimation
- better tokenization
- smarter matching
- article categorization

## Phase 6 — Growth Features

Potentially:

- sharing
- leaderboards
- challenge links
- unlimited mode
- custom puzzles
- Reddit-friendly result cards

## Phase 7 — Scaling

Only if actual usage requires it:

- multiple API servers
- load balancer
- Redis scaling
- database optimization
- workers/queues
- background processing

---

# 59. Important Design Rule for Future Phases

Future phases must build on the existing interfaces.

For example:

```text
ArticleProvider
```

must continue to work whether the implementation is:

```text
LocalArticleProvider
```

or:

```text
WikipediaArticleProvider
```

Similarly:

```text
PuzzleEngine
```

must not depend on PostgreSQL.

And:

```text
Frontend GameEngine
```

must not depend directly on Fastify or Redis.

Maintain dependency direction:

```text
Frontend
    ↓
API contract

Backend
    ↓
Services
    ↓
Repositories
    ↓
Infrastructure

Article Pipeline
    ↓
ArticleProvider

Puzzle Engine
    ↓
Pure domain logic
```

Avoid circular dependencies.

---

# 60. Phase 1 Implementation Order

Cursor must implement Phase 1 in this order.

## Step 1 — Repository initialization

Create:

- git repository structure
- pnpm workspace
- root package.json
- TypeScript configuration
- linting
- formatting
- `.gitignore`
- `.env.example`
- README

Verify the root project installs successfully.

---

## Step 2 — Create workspace applications/packages

Create:

```text
apps/frontend
apps/backend
services/article-provider
services/article-ingestion
packages/puzzle-engine
packages/shared
packages/test-utils
```

Every package must have:

- package.json
- TypeScript configuration if needed
- clear entrypoint
- tests where applicable

---

## Step 3 — Local infrastructure

Create Docker Compose for:

- PostgreSQL
- Redis

Document:

```bash
docker compose -f infrastructure/docker/docker-compose.yml up -d
```

Verify both services are reachable.

---

## Step 4 — Database

Create Prisma configuration.

Create initial schema:

- User
- Article
- Puzzle
- GameResult

Create migration.

Create deterministic seed.

---

## Step 5 — Redis

Create Redis infrastructure/repository.

Implement:

- connection
- health check
- session get
- session set
- session delete
- TTL handling

Test Redis access independently.

---

## Step 6 — Shared contracts

Create shared types/schemas for:

- ClientPuzzle
- PuzzleToken
- GameState
- GuessResult
- SessionState
- GameResult
- API responses/errors

Do not duplicate these structures independently in frontend and backend.

---

## Step 7 — Puzzle engine

Implement and test:

- word normalization
- tokenization
- redaction
- match key generation
- client puzzle generation
- local guess matching
- hit count
- duplicate guess detection
- title detection
- win condition
- serialization

This should be mostly pure logic.

---

## Step 8 — Dummy article provider

Implement:

```text
LocalArticleProvider
```

Return the deterministic dummy article.

Do not make the frontend aware that it is dummy data.

---

## Step 9 — Ingestion pipeline

Implement:

```text
dummy article
 ↓
parser
 ↓
normalizer
 ↓
tokenizer
 ↓
redactor
 ↓
client puzzle generator
 ↓
validator
 ↓
PostgreSQL
```

Seed today's puzzle through this pipeline.

---

## Step 10 — Backend API

Implement:

```text
GET /api/health
GET /api/health/dependencies
GET /api/puzzles/today
GET /api/sessions/current
POST /api/sessions/sync
POST /api/games/complete
GET /api/stats
```

Do not implement guess APIs.

---

## Step 11 — Session management

Implement:

- session ID creation
- cookie
- Redis persistence
- TTL
- recovery
- synchronization
- completion

---

## Step 12 — Frontend

Implement:

- puzzle loading
- puzzle parsing
- game engine integration
- guess input
- guess history
- localStorage persistence
- session synchronization
- win/give-up
- completion API
- basic statistics

---

## Step 13 — Tests

Run:

```bash
pnpm test
pnpm typecheck
pnpm lint
```

Fix all errors.

No known test failures should remain at the end of Phase 1.

---

## Step 14 — Manual verification

Verify the complete flow manually:

```text
Start infrastructure
        ↓
Start backend
        ↓
Start frontend
        ↓
Open browser
        ↓
Load today's puzzle
        ↓
Guess a known word
        ↓
Word reveals
        ↓
Check browser Network tab
        ↓
Confirm no guess request occurred
        ↓
Reload
        ↓
State remains
        ↓
Close tab
        ↓
Reopen
        ↓
State remains
        ↓
Complete game
        ↓
Check PostgreSQL
        ↓
Check Redis session behavior
        ↓
Check statistics
```

---

# 61. Network Tab Verification

This is an explicit acceptance criterion.

When a user submits a guess:

```text
physics
```

the browser Network tab must NOT show:

```text
POST /guess
POST /check-word
POST /reveal
```

or equivalent.

The only network activity related to gameplay should be background session synchronization or final game completion.

The actual matching must happen locally.

---

# 62. Developer Experience Requirement

A new developer should be able to clone the project and understand what to do from `README.md`.

The README must contain:

## Prerequisites

- Node.js version
- pnpm version
- Docker
- Docker Compose

## Installation

Exact commands.

## Environment

Tell the developer to:

```bash
cp .env.example .env
```

Then explicitly tell them which values they must fill in.

Do not assume they know what `DATABASE_URL` or `REDIS_URL` should be.

For local Docker Compose, provide example values where appropriate.

## Start infrastructure

Exact command.

## Database migration

Exact command.

## Seed

Exact command.

## Start development servers

Exact command.

## Run tests

Exact commands.

## Run lint/typecheck

Exact commands.

## API testing

Examples.

## Troubleshooting

At least cover:

- PostgreSQL unavailable
- Redis unavailable
- port already in use
- migration failure
- missing environment variables

---

# 63. Environment Setup Should Be Friendly

The user should not have to manually discover database credentials.

For local development, Docker Compose can define known development credentials.

For example:

```env
POSTGRES_DB=redactle
POSTGRES_USER=redactle
POSTGRES_PASSWORD=redactle_dev
```

and:

```env
DATABASE_URL=postgresql://redactle:redactle_dev@localhost:5432/redactle
REDIS_URL=redis://localhost:6379
```

These are development-only values.

Production credentials must never be committed.

---

# 64. Root Commands

The root `package.json` should expose convenient commands.

Target interface:

```bash
pnpm install

pnpm infra:up
pnpm infra:down

pnpm db:migrate
pnpm db:seed
pnpm db:reset

pnpm dev

pnpm test
pnpm test:watch

pnpm lint
pnpm typecheck

pnpm ingest:dummy
```

The implementation may use pnpm workspace filtering internally.

The goal is that the developer does not have to memorize package-specific commands for common operations.

---

# 65. API Contract Documentation

Create:

```text
docs/api/README.md
```

Document every Phase 1 endpoint:

- method
- path
- purpose
- request
- response
- status codes
- authentication/session behavior
- errors

Explicitly document that:

```text
There is no guess API.
```

---

# 66. Architecture Documentation

Create:

```text
docs/architecture/overview.md
```

Include:

- component diagram
- data ownership
- request flow
- gameplay flow
- session flow
- ingestion flow
- database role
- Redis role
- future scaling direction

Keep it synchronized with the implementation.

---

# 67. Code Quality Rules

Use TypeScript strictly.

Avoid:

```ts
any
```

unless there is a documented reason.

Prefer:

- explicit types
- small modules
- dependency injection where useful
- pure functions for puzzle/game logic
- repositories for persistence
- services for business logic
- schemas for external input validation

Do not over-engineer abstractions that have no current purpose.

---

# 68. Dependency Direction

The most important dependency rule:

```text
Puzzle Engine
    ↓
must NOT depend on:
    PostgreSQL
    Redis
    Fastify
    Next.js
```

It should be usable independently.

Similarly:

```text
Article Provider
```

must not depend on frontend code.

The frontend must not import backend infrastructure.

---

# 69. Testing the Architecture

Tests should prove boundaries.

For example:

### Puzzle engine

Can run with:

```text
no database
no Redis
no HTTP server
```

### Backend session service

Can be tested against:

```text
Redis test instance/mock
```

### Backend API

Can be tested without running Next.js.

### Frontend game engine

Can be tested without running the backend.

This separation is intentional.

---

# 70. Acceptance Criteria for Phase 1

Phase 1 is complete only when all of these are true:

- [ ] Repository is initialized.
- [ ] Monorepo/workspaces are configured.
- [ ] Frontend exists and runs.
- [ ] Backend exists and runs.
- [ ] Article provider exists.
- [ ] Article ingestion service exists.
- [ ] Puzzle engine exists.
- [ ] Shared package exists.
- [ ] PostgreSQL runs locally.
- [ ] Redis runs locally.
- [ ] Prisma migration works.
- [ ] Seed works.
- [ ] Dummy article is processed through the real ingestion pipeline.
- [ ] Today's puzzle is stored in PostgreSQL.
- [ ] Frontend receives only the client-safe puzzle representation.
- [ ] Full article is not returned by the puzzle API.
- [ ] User can see the redacted article.
- [ ] User can guess words.
- [ ] Guess matching occurs locally.
- [ ] Guessing does not create a network request.
- [ ] Correct words are revealed.
- [ ] Hit counts work.
- [ ] Duplicate guesses work correctly.
- [ ] Win condition works.
- [ ] Give-up works.
- [ ] localStorage preserves active game state.
- [ ] Reload preserves active game state.
- [ ] Closing/reopening the browser preserves active game state.
- [ ] Session cookie exists.
- [ ] Redis contains active session state after synchronization.
- [ ] Session recovery works.
- [ ] Game completion creates a durable GameResult.
- [ ] Duplicate completion is idempotent.
- [ ] Basic statistics work.
- [ ] Unit tests pass.
- [ ] Backend tests pass.
- [ ] Frontend tests pass.
- [ ] TypeScript checks pass.
- [ ] Lint passes.
- [ ] README explains complete setup.
- [ ] API documentation exists.
- [ ] Architecture documentation exists.
- [ ] Developer can run the entire project without guessing commands.

---

# 71. Important Instructions for Cursor

Before changing code, inspect the entire repository and determine whether it is empty or already contains files.

If the repository is empty:

1. Initialize the complete structure.
2. Install dependencies.
3. Create all workspace packages.
4. Create configuration.
5. Create infrastructure.
6. Create documentation.
7. Then implement Phase 1.

If something already exists:

- do not blindly overwrite it
- inspect it first
- preserve useful existing configuration
- explain conflicts before making destructive changes

Do not skip the architecture setup because dummy data is being used.

---

# 72. Cursor Must Work Incrementally

Implement Phase 1 in the specified order.

After each major subsystem:

1. Run its tests.
2. Run type checking.
3. Verify the subsystem works.
4. Continue to the next subsystem.

Do not implement the entire project in one giant untested change.

---

# 73. Cursor Must Not Invent Missing Secrets

If a real external credential, database connection string, Redis URL, or API key is required:

1. Add it to `.env.example`.
2. Add validation.
3. Tell the developer exactly what value needs to be entered.
4. Do not invent a real secret.
5. Do not commit `.env`.

For local Docker infrastructure, safe development-only credentials may be defined explicitly.

---

# 74. Cursor Must Explain Important Decisions

When implementing a non-obvious architectural choice, add a short comment or documentation entry explaining why.

Especially explain:

- why guesses are client-side
- why Redis stores active sessions
- why PostgreSQL stores completed results
- why localStorage is used instead of sessionStorage
- why full article content is not returned
- why the article provider is abstracted
- why published puzzles are immutable
- why the puzzle engine is independent of the backend

---

# 75. Final Phase 1 Architecture

The final Phase 1 system should conceptually look like this:

```text
                         ┌──────────────────────┐
                         │      Wikipedia       │
                         │   (future source)    │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │   Article Provider   │
                         │                      │
                         │ Local / Wikipedia    │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │ Article Ingestion    │
                         │                      │
                         │ Parse                │
                         │ Normalize            │
                         │ Tokenize             │
                         │ Redact               │
                         │ Match Data           │
                         │ Validate             │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │     PostgreSQL       │
                         │                      │
                         │ Articles             │
                         │ Puzzles              │
                         │ Users                │
                         │ Game Results         │
                         └──────────┬───────────┘
                                    │
                                    │ cache
                                    ▼
                              ┌───────────┐
                              │   Redis   │
                              │           │
                              │ Sessions  │
                              │ Cache     │
                              └─────┬─────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │      Backend API     │
                         │                      │
                         │ Puzzle delivery      │
                         │ Session recovery     │
                         │ Session sync         │
                         │ Game completion      │
                         │ Statistics           │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │       Next.js        │
                         │       Frontend       │
                         │                      │
                         │ Redacted article     │
                         │ Local game engine    │
                         │ Local game state     │
                         │ Guess processing     │
                         └──────────┬───────────┘
                                    │
                                    ▼
                              localStorage
```

The key gameplay path is:

```text
                 USER GUESS

                     │
                     ▼
              ┌──────────────┐
              │   Frontend   │
              └──────┬───────┘
                     │
                     ▼
              Normalize guess
                     │
                     ▼
               Local matcher
                     │
                     ▼
              Find token IDs
                     │
                     ▼
              Reveal locally
                     │
                     ▼
               Update state
                     │
                     ▼
               localStorage

              NO API REQUEST
```

The persistence path is separate:

```text
local game state
       │
       │ periodic sync
       ▼
Backend
       │
       ▼
Redis
```

And the durable path is:

```text
Game completed
       │
       ▼
Backend
       │
       ▼
PostgreSQL
       │
       ▼
GameResult / Statistics
```

---

# 76. Final Instruction

Implement **Phase 1 only**.

Do not start Phase 2 features.

The objective is not merely to make a webpage that looks like Redactle.

The objective is to create the complete architectural foundation so that Phase 2 can replace:

```text
Dummy LocalArticleProvider
```

with:

```text
Real Wikipedia dataset
```

without requiring a rewrite of:

- frontend
- backend API
- session architecture
- Redis layer
- puzzle engine
- database model
- game engine

The Phase 1 implementation should therefore be considered successful when the complete dummy-data game works end-to-end and all architectural boundaries are already in place.
