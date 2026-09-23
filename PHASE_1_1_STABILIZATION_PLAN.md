# Redactle Clone — Phase 1.1 Stabilization Plan

## 0. Purpose

Phase 1 of the Redactle-like game is already implemented and running.

Phase 1.1 is **not a rebuild**. It is a stabilization/correctness phase before Phase 2 (real Wikipedia data).

Inspect the existing Phase 1 implementation first. Preserve working architecture and make targeted changes.

The three goals are:

1. Replace the current readable client puzzle payload with a compact, opaque, client-playable representation.
2. Automatically finish the game when all title words are revealed.
3. Persist terminal game state across reload/reopen and support explicit replay as a new attempt.

---

# 1. Existing Architecture to Preserve

Keep the current boundaries:

```text
Frontend
Backend API
Article Provider
Article Ingestion
Puzzle Engine
Shared Package
PostgreSQL
Redis
```

Ownership remains:

```text
Browser
    ↓
active gameplay
local matching
localStorage
```

```text
Backend
    ↓
puzzle delivery
session recovery
session synchronization
game completion
statistics
```

```text
Redis
    ↓
active/recoverable sessions
puzzle cache
```

```text
PostgreSQL
    ↓
articles
published puzzles
users
completed game results
```

Do not introduce:

- multiple API servers
- Kubernetes
- Kafka
- queues
- Elasticsearch
- AI
- multiplayer
- real Wikipedia ingestion

Those belong to later phases.

---

# 2. Critical Gameplay Rule

A player guess must remain entirely client-side.

The flow is:

```text
User enters guess
        ↓
Frontend Game Engine
        ↓
Normalize
        ↓
Match locally
        ↓
Reveal matching words
        ↓
Update GameState
        ↓
Persist local state
```

There must be no API request to determine whether a guess matches.

Do not create:

```text
POST /guess
POST /check-word
POST /reveal-word
POST /check-answer
```

The backend is used for:

- puzzle retrieval
- session recovery
- session synchronization
- game completion
- statistics

---

# 3. Problem A — `/api/puzzles/today` Exposes Hidden Words

The current flow is approximately:

```text
GET /api/puzzles/today
        ↓
PuzzleService.getToday()
        ↓
PuzzleRepository.getTodayClientPuzzle()
        ↓
puzzle.clientPuzzleData
        ↓
JSON response
        ↓
Browser
```

The current client data contains enough readable information to expose hidden words in the Network tab.

This must be fixed.

The full article must remain server-side.

The browser must still be able to perform local word matching.

---

# 4. Important Security Reality

Client-side matching means the browser necessarily has some derived information about hidden words.

Perfect secrecy is impossible when the browser itself performs the matching.

Therefore the requirement is:

> The normal API response must not directly expose the full article or a readable hidden-word dictionary.

Do not claim that the client puzzle is impossible to reverse-engineer.

A determined player can inspect client-side runtime data.

The objective is to prevent straightforward exposure of the article/answer through the Network response.

---

# 5. New Puzzle Representation

Separate these concepts:

```text
ServerPuzzle
ClientPuzzlePayload
GameState
```

They must not be the same object.

## ServerPuzzle

May contain:

```text
id
articleId
puzzleNumber
scheduledDate
generatorVersion
answerTitle
internal puzzle representation
client payload
status
```

This must never be serialized directly into the API response.

## ClientPuzzlePayload

The public API should contain only something conceptually like:

```json
{
  "id": "183",
  "puzzleNumber": 183,
  "scheduledDate": "2026-08-13",
  "generatorVersion": "1.0.0",
  "payload": "OPAQUE_ENCODED_PAYLOAD"
}
```

Do not return:

- full article
- plaintext answer
- readable hidden-word dictionary
- server-only fields
- raw article content

---

# 6. Compact Puzzle Representation

Do not represent every word, space and separator as a heavyweight JSON object.

Avoid:

```json
[
  { "type": "word", "value": "Albert" },
  { "type": "whitespace", "value": " " },
  { "type": "word", "value": "Einstein" }
]
```

for every token.

A real Wikipedia article may be very large.

Instead create a compact representation conceptually consisting of:

```text
Dictionary
    unique word values

Token stream
    compact references to dictionary entries
    structural/text information

Title token IDs
    identifies words belonging to the article title

Formatting/structure
    paragraphs
    headings
    punctuation
    relevant whitespace
```

For example:

```text
dictionary:
0 = Albert
1 = Einstein
2 = was
3 = a
4 = physicist

token stream:
0, separator, 1, separator, 2, separator, 3, separator, 4
```

The actual implementation can be more compact.

The important requirement is that a large article does not become tens of thousands of heavyweight JSON objects.

---

# 7. Client Payload Pipeline

Generate the client payload during puzzle generation/ingestion:

```text
Raw Article
    ↓
Parse
    ↓
Normalize
    ↓
Tokenize
    ↓
Generate compact puzzle representation
    ↓
Generate title-token information
    ↓
Generate client matching information
    ↓
Serialize
    ↓
Compress
    ↓
Encode / obfuscate
    ↓
Store client payload
```

Do NOT perform this expensive work in `/api/puzzles/today`.

The request-time path must be:

```text
GET /api/puzzles/today
        ↓
Redis
        ↓
cache hit → return
        ↓
cache miss
        ↓
PostgreSQL
        ↓
cache
        ↓
return
```

---

# 8. Compression and Payload Benchmark

The new representation must be benchmarked.

Use at least:

- small dummy article
- medium article
- large article representative of a real Wikipedia page

Measure:

```text
raw article size
current client JSON size
compact representation size
compressed representation size
final encoded payload size
```

The test/output should make it obvious whether the new representation scales reasonably.

Document the result briefly.

---

# 9. Encoding / Obfuscation

The final network payload should not be readable plaintext JSON.

A practical pipeline is:

```text
compact serialization
        ↓
compression
        ↓
encoding
```

An additional client-decodable obfuscation/encryption layer may be used if useful.

Do not build an unnecessarily complicated cryptographic system.

A client-side secret cannot truly be secret from the client.

The goal is an opaque network payload, not impossible anti-cheat.

---

# 10. Frontend Decode Boundary

The frontend should receive the opaque payload:

```text
GET /api/puzzles/today
        ↓
opaque payload
        ↓
decode
        ↓
decompress
        ↓
deserialize
        ↓
ClientPuzzle
        ↓
Game Engine
```

Put decoding/deserialization in the puzzle-engine package or a dedicated puzzle client module.

Do not put decoding logic inside React components.

---

# 11. Client Puzzle Internal Model

After decoding, the frontend needs enough information to:

- render the redacted article
- preserve structure
- know word boundaries
- know word lengths
- identify title words
- perform local matching
- reveal matched words

Conceptually:

```ts
interface ClientPuzzle {
  puzzleId: string;
  puzzleNumber: number;
  scheduledDate: string;
  generatorVersion: string;
  tokens: PuzzleToken[];
  titleTokenIds: string[];
}
```

The exact implementation may use a more compact internal structure.

Do not force every token to become a large JavaScript object if a more efficient representation is practical.

---

# 12. Preserve Redactle-Style Rendering

The UI should continue to support representations like:

```html
<span word-length="14" class="word redacted">
  ██████████████
</span>
```

Before reveal:

```text
██████████████
```

After reveal:

```text
Albert
```

Preserve:

- paragraphs
- headings
- punctuation
- relevant whitespace
- word lengths
- title marking
- article structure

---

# 13. Database Representation

Store the generated client payload with the published puzzle.

Conceptually:

```text
Puzzle
----------------------------
id
articleId
puzzleNumber
scheduledDate
generatorVersion
clientPuzzlePayload
status
createdAt
publishedAt
```

The full article remains in the Article entity:

```text
Article.rawContent
```

and must never be included in the client DTO.

If the existing schema uses `clientPuzzleData`, migrate it carefully rather than destroying working data.

---

# 14. Redis Puzzle Cache

Use a key such as:

```text
redactle:puzzle:today:<date>
```

The cached value should already be the exact safe public response or opaque payload.

For example:

```json
{
  "id": "183",
  "puzzleNumber": 183,
  "scheduledDate": "2026-08-13",
  "generatorVersion": "1.0.0",
  "payload": "..."
}
```

The cache must not contain:

- full article
- plaintext answer
- readable hidden-word dictionary

---

# 15. `/api/puzzles/today` Requirements

Keep the existing endpoint:

```text
GET /api/puzzles/today
```

but change the response representation.

It should be a thin delivery endpoint.

Do not regenerate or reprocess the article during the request.

Do not return the full server-side puzzle object.

The API response must be a public DTO containing only:

```text
id
puzzleNumber
scheduledDate
generatorVersion
payload
```

or equivalent safe metadata.

---

# 16. Problem B — Automatic Win Condition

The game must automatically finish when all words in the actual article title are revealed.

This belongs in the game engine, not React UI code.

The puzzle must contain:

```text
titleTokenIds
```

or an equivalent compact representation.

For example:

```text
title:
Albert Einstein

titleTokenIds:
[token-1, token-2]
```

When only one is revealed:

```text
IN_PROGRESS
```

When all are revealed:

```text
WON
```

---

# 17. Game State Machine

Use explicit states:

```text
IN_PROGRESS
WON
GAVE_UP
```

Transitions:

```text
                 ┌──────────────┐
                 │ IN_PROGRESS  │
                 └──────┬───────┘
                        │
              ┌─────────┴─────────┐
              │                   │
       title complete          Give Up
              │                   │
              ▼                   ▼
         ┌─────────┐         ┌──────────┐
         │   WON   │         │ GAVE_UP  │
         └────┬────┘         └────┬─────┘
              │                   │
              └─────────┬─────────┘
                        │
                     Replay
                        │
                        ▼
                  IN_PROGRESS
                  new attempt
```

A reload must never transition:

```text
WON → IN_PROGRESS
```

or:

```text
GAVE_UP → IN_PROGRESS
```

Only explicit replay can do that.

---

# 18. Game Engine Completion Logic

Completion should be derived from puzzle + guesses.

Conceptually:

```ts
const allTitleTokensRevealed =
  puzzle.titleTokenIds.every(
    (tokenId) => revealedTokenIds.has(tokenId)
  );
```

When true:

```text
status = WON
completedAt = now
```

The guess result should expose the new status.

Conceptually:

```ts
interface GuessResult {
  normalizedGuess: string;
  hitCount: number;
  matchedTokenIds: string[];
  gameCompleted: boolean;
  status: "IN_PROGRESS" | "WON" | "GAVE_UP";
}
```

Reuse/extend existing types rather than creating duplicate competing models.

---

# 19. Congratulations UI

When:

```text
status === WON
```

show a terminal state.

Example:

```text
🎉 Congratulations!

You solved today's puzzle.

[Article Title]

Guesses: 27
Time: 08:42

[Play Again]
```

The exact styling is not important.

The behavior is important:

- game input is disabled
- further guesses are rejected
- completion is persisted
- reload shows the completed state
- replay is available

---

# 20. Give Up

When the player selects Give Up:

```text
IN_PROGRESS → GAVE_UP
```

Show:

```text
Game Over

The answer was:

[Article Title]

[Play Again]
```

The terminal state must be persisted.

---

# 21. Problem C — Persistent Completed State

The browser-side GameState must explicitly contain terminal state.

Example:

```json
{
  "puzzleId": "183",
  "attemptId": "uuid",
  "status": "WON",
  "guesses": [
    "albert",
    "einstein"
  ],
  "startedAt": 1786530000000,
  "completedAt": 1786530400000
}
```

or:

```json
{
  "puzzleId": "183",
  "attemptId": "uuid",
  "status": "GAVE_UP",
  "guesses": [],
  "startedAt": 1786530000000,
  "completedAt": 1786530200000
}
```

Persist terminal state explicitly.

Do not infer completion only from the rendered UI.

---

# 22. localStorage

Continue using:

```text
localStorage
```

not `sessionStorage`.

The requirement is to survive:

- page reload
- tab close
- browser reopen

Store compact state:

```text
puzzleId
attemptId
status
guesses
startedAt
completedAt
```

Do not store a giant rendered HTML snapshot.

The UI must derive its current representation from:

```text
decoded puzzle
+
GameState
```

---

# 23. Session Cookie

Continue using the session cookie only as the identifier for the server-side session.

It must not contain:

- full game state
- article
- answer
- guesses

Use an opaque session ID.

---

# 24. Redis Terminal Sessions

When a game completes, do NOT immediately delete the Redis session.

Keep terminal state for the normal session TTL.

For example:

```text
redactle:session:<sessionId>
```

may contain:

```json
{
  "puzzleId": "183",
  "attemptId": "uuid",
  "status": "WON",
  "guesses": [
    "albert",
    "einstein"
  ],
  "startedAt": 1786530000000,
  "completedAt": 1786530400000
}
```

This allows server-side recovery after reload/browser reopen.

---

# 25. Page Load / Recovery Algorithm

On page load:

```text
1. Fetch today's puzzle.

2. Read localStorage.

3. If local state exists:
      If puzzleId matches current puzzle:
          restore it.
      Otherwise:
          ignore stale state.

4. If local state is unavailable/invalid:
      request current server session.

5. If server session exists for this puzzle:
      restore it.

6. Otherwise:
      create a new IN_PROGRESS attempt.
```

If restored status is:

```text
WON
```

show completed UI.

If restored status is:

```text
GAVE_UP
```

show completed UI.

Do not create a new game simply because the current game is terminal.

---

# 26. Attempt IDs

Replay means one user can have multiple attempts on the same puzzle.

Add:

```text
attemptId
```

to GameState.

Example:

```json
{
  "puzzleId": "183",
  "attemptId": "attempt-1",
  "status": "WON"
}
```

Replay creates:

```json
{
  "puzzleId": "183",
  "attemptId": "attempt-2",
  "status": "IN_PROGRESS"
}
```

This prevents stale state from being confused with a new attempt.

---

# 27. Replay

When the completed game displays:

```text
[Play Again]
```

the player may explicitly replay.

Replay must:

1. Generate a new `attemptId`.
2. Reset guesses.
3. Reset status to `IN_PROGRESS`.
4. Reset `startedAt`.
5. Keep the same puzzle.
6. Persist the new local state.
7. Synchronize the new active state to Redis.
8. Preserve all old GameResults.

Do not overwrite the previous result.

---

# 28. GameResult Changes

Because replay is allowed, multiple results may exist for:

```text
user + puzzle
```

Do not enforce uniqueness on only:

```text
userId + puzzleId
```

Conceptually:

```text
GameResult
----------------------------
id
userId
puzzleId
attemptId
attemptNumber
status
guessCount
startedAt
completedAt
duration
score
isOfficial
```

Adapt this to the existing schema.

Do not unnecessarily rewrite the entire database model.

---

# 29. Official Result vs Replay

Treat the first completed attempt for a user/puzzle as the official daily result.

Example:

```text
Puzzle #183

Attempt 1 → WON → 31 guesses → official
Attempt 2 → WON → 18 guesses → replay
Attempt 3 → GAVE_UP → replay
```

Normal daily statistics should not be inflated by replays.

Use:

```text
isOfficial = true
```

for the first completed attempt.

Later attempts:

```text
isOfficial = false
```

If the existing statistics system is too simple, implement the minimum needed to preserve this distinction.

---

# 30. Game Completion API

Continue using:

```text
POST /api/games/complete
```

This endpoint persists a completed game.

It is NOT a guess API.

The frontend calls it only after:

```text
WON
```

or:

```text
GAVE_UP
```

The backend must:

1. Validate session.
2. Validate puzzle ID.
3. Validate attempt ID.
4. Ensure the attempt is not already completed.
5. Persist GameResult.
6. Keep Redis session in terminal state.
7. Return persisted result.

---

# 31. Completion Idempotency

If the frontend sends completion twice for the same:

```text
sessionId + attemptId
```

do not create duplicate results.

Return the existing result or an equivalent idempotent response.

Use the database/schema to enforce this where appropriate.

---

# 32. Session Synchronization

Continue the existing background synchronization.

The payload should contain:

```text
puzzleId
attemptId
status
guesses
startedAt
completedAt if terminal
```

Do not send an API request for every guess.

The browser remains authoritative for immediate gameplay.

---

# 33. Network Tab Acceptance Test

When the user enters:

```text
physics
```

and submits it:

There must be no request such as:

```text
POST /guess
POST /check-word
POST /reveal
GET /article
```

The match must happen locally.

Background synchronization is allowed, but it must not perform the word check.

---

# 34. `/api/puzzles/today` Acceptance Test

Inspect the actual response in DevTools.

It must not directly expose:

```text
full article
plaintext answer
readable hidden-word dictionary
```

The response should conceptually be:

```json
{
  "id": "183",
  "puzzleNumber": 183,
  "scheduledDate": "2026-08-13",
  "generatorVersion": "1.0.0",
  "payload": "..."
}
```

The payload should not be human-readable JSON containing the article.

The frontend must successfully decode it and play the puzzle.

---

# 35. Large Article Acceptance Test

Run the representation benchmark against:

- small dummy article
- medium article
- large representative article

Record:

```text
raw article bytes
old payload bytes
new compact bytes
compressed bytes
final payload bytes
```

The implementation must avoid a design that creates a heavyweight object for every word/separator.

---

# 36. Automated Tests

Add regression tests for all three problems.

## Puzzle payload

Test:

- client response contains no full article
- client response contains no plaintext answer field
- client payload is opaque
- encode/decode round trip works
- compression/decompression round trip works
- decoded puzzle can be played
- title token information survives round trip
- large article payload is reasonably compact

## Game engine

Test:

- correct guess
- incorrect guess
- duplicate guess
- multiple occurrences
- partial title reveal
- complete title reveal
- automatic WON
- no guesses after WON
- Give Up
- no guesses after GAVE_UP
- replay resets state
- replay creates new attempt ID

## Persistence

Test:

- IN_PROGRESS serialization
- WON serialization
- GAVE_UP serialization
- restore completed state
- stale puzzle state rejected
- Redis terminal session recovery
- replay state creation

## Backend

Test:

- `/api/puzzles/today`
- `/api/sessions/current`
- `/api/sessions/sync`
- `/api/games/complete`
- duplicate completion
- completed-session recovery
- replay

---

# 37. Manual Test Checklist

## Puzzle payload

- [ ] Open DevTools.
- [ ] Open Network.
- [ ] Load `/api/puzzles/today`.
- [ ] Inspect response.
- [ ] Confirm no plaintext article.
- [ ] Confirm no direct answer field.
- [ ] Confirm hidden words are not directly readable.
- [ ] Confirm frontend decodes and renders puzzle.

## Guessing

- [ ] Enter incorrect guess.
- [ ] Confirm no guess-check API request.
- [ ] Enter correct guess.
- [ ] Confirm words reveal.
- [ ] Confirm hit count.
- [ ] Test duplicate guess.

## Winning

- [ ] Reveal all title words.
- [ ] Confirm automatic WON.
- [ ] Confirm congratulations UI.
- [ ] Confirm input is disabled.
- [ ] Reload.
- [ ] Confirm WON remains.

## Give Up

- [ ] Start fresh attempt.
- [ ] Click Give Up.
- [ ] Confirm GAVE_UP.
- [ ] Confirm answer display.
- [ ] Reload.
- [ ] Confirm GAVE_UP remains.

## Replay

- [ ] Click Play Again.
- [ ] Confirm new attempt.
- [ ] Confirm guesses reset.
- [ ] Confirm status is IN_PROGRESS.
- [ ] Confirm attempt ID changed.
- [ ] Confirm old GameResult remains.

---

# 38. Redis Verification

During active play:

```text
redactle:session:<sessionId>
```

must exist.

After winning:

```text
status = WON
```

must remain.

After Give Up:

```text
status = GAVE_UP
```

must remain.

After replay:

```text
attemptId changes
status = IN_PROGRESS
guesses = []
```

---

# 39. PostgreSQL Verification

After completion:

```text
GameResult exists
```

with:

- correct puzzle
- correct attempt ID
- correct status
- correct guess count
- correct completion timestamp
- correct official/replay status

After replay, the old result must remain.

---

# 40. Documentation

Update:

```text
README.md
docs/architecture/overview.md
docs/api/README.md
```

Document:

- opaque client puzzle payload
- local game engine
- localStorage
- Redis active/terminal sessions
- title-based completion
- replay attempts
- GameResult persistence
- official result vs replay

---

# 41. No Phase 2 Work

Do not implement:

- real Wikipedia ingestion
- 1,000/10,000 article import
- Wikipedia scheduling
- daily Wikipedia API calls
- smart lemmatization
- AI
- multiplayer
- leaderboards
- social sharing
- multiple API servers
- Kubernetes
- queues

Phase 1.1 only fixes the existing MVP.

---

# 42. Implementation Order

## Step 1 — Inspect

Inspect the existing implementation before changing anything.

Specifically inspect:

- current puzzle schema
- Prisma model
- puzzle repository
- puzzle service
- puzzle engine
- ingestion pipeline
- client puzzle schema
- frontend puzzle loading
- frontend game engine
- localStorage
- Redis sessions
- game completion
- GameResult
- statistics

---

## Step 2 — Fix Puzzle Representation

Implement:

```text
compact representation
    ↓
serialization
    ↓
compression
    ↓
encoding/obfuscation
    ↓
client payload
```

Update all affected server/client types and tests.

---

## Step 3 — Fix Win Condition

Implement title-token tracking and automatic WON state.

Add congratulations UI.

---

## Step 4 — Fix Terminal Persistence

Make:

```text
WON
GAVE_UP
```

survive:

- reload
- close/reopen

using:

```text
localStorage
+
cookie/session
+
Redis
```

---

## Step 5 — Implement Replay

Add attempt IDs.

Reset active state only after explicit replay.

Preserve old GameResults.

---

## Step 6 — Tests

Run all tests and add regression tests.

---

## Step 7 — Manual Verification

Complete the full manual checklist.

---

## Step 8 — Documentation

Update README and architecture/API documentation.

---

# 43. Cursor Instructions

## Do not rewrite the project

This is an existing working Phase 1 implementation.

Inspect first and make targeted changes.

## Do not create guess APIs

Guessing remains client-side.

## Do not expose the full article

The API returns only the client puzzle payload.

## Do not use sessionStorage

Use localStorage for persistent browser game state.

## Do not delete completed Redis state immediately

Terminal state must remain recoverable.

## Do not overwrite completed GameResults

Replay creates a new attempt.

## Do not create huge token-object JSON

Use a compact representation suitable for large Wikipedia articles.

## Do not over-engineer cryptography

The payload needs to be opaque to normal Network inspection, not mathematically impossible to reverse-engineer.

---

# 44. Phase 1.1 Acceptance Criteria

Phase 1.1 is complete only when:

- [ ] `/api/puzzles/today` no longer returns plaintext hidden words.
- [ ] `/api/puzzles/today` does not return the full article.
- [ ] `/api/puzzles/today` does not directly return the answer.
- [ ] Client puzzle payload is compact.
- [ ] Client puzzle payload is opaque/encoded in the Network tab.
- [ ] Client can decode the payload.
- [ ] Client can render the redacted article.
- [ ] Client can locally match guesses.
- [ ] Guessing does not require a guess API.
- [ ] Large-article payload size has been measured.
- [ ] Puzzle generation creates the client payload before request time.
- [ ] Redis caches the public puzzle payload.
- [ ] PostgreSQL stores the generated client payload.
- [ ] Full article remains server-side.
- [ ] Title token IDs are represented.
- [ ] Revealing all title words automatically ends the game.
- [ ] WON state is persisted.
- [ ] GAVE_UP state is persisted.
- [ ] WON survives reload.
- [ ] GAVE_UP survives reload.
- [ ] WON survives browser close/reopen.
- [ ] GAVE_UP survives browser close/reopen.
- [ ] Congratulations UI appears after winning.
- [ ] Give-up UI appears after giving up.
- [ ] Completed games cannot continue guessing.
- [ ] Replay is explicit.
- [ ] Replay creates a new attempt ID.
- [ ] Replay resets guesses/status.
- [ ] Previous completed results remain in PostgreSQL.
- [ ] Duplicate completion is idempotent.
- [ ] Redis contains recoverable terminal state.
- [ ] Existing Phase 1 functionality still works.
- [ ] All tests pass.
- [ ] TypeScript checks pass.
- [ ] Lint passes.
- [ ] README is updated.
- [ ] Architecture documentation is updated.
- [ ] API documentation is updated.

---

# 45. Final Expected Architecture

```text
                         ARTICLE / PUZZLE SIDE

                    Full Article
                    PostgreSQL
                         │
                         ▼
                  Puzzle Generator
                         │
              ┌──────────┴──────────┐
              │                      │
        Compact Puzzle          Title Tokens
              │                      │
              └──────────┬───────────┘
                         ▼
                 Serialize/Compress
                         │
                         ▼
                  Opaque Payload
                         │
                         ▼
                     PostgreSQL
                         │
                         ▼
                       Redis
                         │
                         ▼
                    /today API
                         │
                         ▼
                      Browser


                         GAMEPLAY

                  Opaque Puzzle Payload
                         │
                         ▼
                  Decode/Decompress
                         │
                         ▼
                    Client Puzzle
                         │
                         ▼
                   Local Game Engine
                         │
                ┌────────┴────────┐
                │                 │
              Guess          Title complete
                │                 │
                ▼                 ▼
           Local Match           WON
                │                 │
                ▼                 ▼
          Reveal Words     Congratulations
                │                 │
                ▼                 ▼
           localStorage      Redis sync
                │                 │
                └────────┬────────┘
                         ▼
                    Game Complete
                         │
                         ▼
                    PostgreSQL
                    GameResult


                         REPLAY

                   WON / GAVE_UP
                         │
                         │ explicit Replay
                         ▼
                  New attemptId
                         │
                         ▼
                    IN_PROGRESS
```

The key invariants after Phase 1.1 are:

1. **The browser receives a playable puzzle, not the full article.**
2. **The browser owns immediate guess processing.**
3. **No API request checks individual guesses.**
4. **Redis owns recoverable active and terminal sessions.**
5. **PostgreSQL owns durable articles, puzzles, and completed results.**
6. **All title words being revealed automatically produces WON.**
7. **WON and GAVE_UP survive reload/reopen.**
8. **Only explicit Replay starts a new attempt.**
9. **Replays never destroy previous completed results.**
10. **The puzzle payload is compact enough to scale to large Wikipedia articles.**

Do not begin Phase 2 until all Phase 1.1 acceptance criteria are verified.
