import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { PrismaClient } from "@prisma/client";
import { createArticleProvider, WikipediaProviderError } from "@redactle/article-provider";
import { runIngestionPipeline, persistPipelineResult } from "@redactle/article-ingestion";
import { REDIS_PUZZLE_TODAY_KEY } from "@redactle/shared";
import { decodeClientPayload } from "@redactle/puzzle-engine";
import { loadConfig } from "./infrastructure/config/env.js";
import { buildApp } from "./app.js";
import { disconnectPrisma } from "./infrastructure/postgres/prisma.js";
import { disconnectRedis, getRedis } from "./infrastructure/redis/redis-client.js";
import { AppError } from "./modules/errors.js";
import type { GoogleOAuthAdapter, GoogleProfile } from "./modules/auth/google-oauth.js";
import { CapturingMailer } from "./modules/auth/mailer.js";
import { hashAuthToken } from "./modules/auth/tokens.js";

class TestGoogleOAuth implements GoogleOAuthAdapter {
  readonly states = new Map<string, string>();
  readonly profiles = new Map<string, GoogleProfile>();

  isConfigured(): boolean {
    return true;
  }

  async createAuthorizationUrl(sessionId: string): Promise<string> {
    const state = randomUUID();
    this.states.set(state, sessionId);
    return `https://accounts.google.com/o/oauth2/v2/auth?state=${state}`;
  }

  async exchangeCallback(input: {
    code: string;
    state: string;
    sessionId: string;
  }): Promise<GoogleProfile> {
    const bound = this.states.get(input.state);
    if (!bound || bound !== input.sessionId) {
      throw new AppError("INVALID_OAUTH_STATE", "OAuth state does not match this session.", 400);
    }
    this.states.delete(input.state);
    const profile = this.profiles.get(input.code);
    if (!profile) {
      throw new AppError("INVALID_OAUTH_CALLBACK", "Invalid OAuth callback.", 400);
    }
    return profile;
  }
}

const prisma = new PrismaClient();
const googleOAuth = new TestGoogleOAuth();
const mailer = new CapturingMailer();
let app: FastifyInstance;
let config: ReturnType<typeof loadConfig>;
let puzzleId = "";
let adminSession = "";
const fetchPage = vi.fn();

async function cookieFrom(res: { cookies: Array<{ name: string; value: string }> }): Promise<string> {
  const cookie = res.cookies.find((entry) => entry.name === config.SESSION_COOKIE_NAME);
  if (!cookie?.value) {
    throw new Error("Missing session cookie");
  }
  return cookie.value;
}

async function newSessionCookie(): Promise<string> {
  const today = await app.inject({ method: "GET", url: "/api/puzzles/today" });
  return cookieFrom(today);
}

async function login(sessionId: string, code: string) {
  const start = await app.inject({
    method: "GET",
    url: "/api/auth/google",
    cookies: { [config.SESSION_COOKIE_NAME]: sessionId },
  });
  const location = String(start.headers.location ?? "");
  const state = new URL(location).searchParams.get("state");
  if (start.statusCode !== 302 || !state) {
    return start;
  }
  return app.inject({
    method: "GET",
    url: `/api/auth/google/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`,
    cookies: { [config.SESSION_COOKIE_NAME]: sessionId },
  });
}

function cookies(sessionId: string): Record<string, string> {
  return { [config.SESSION_COOKIE_NAME]: sessionId };
}

async function todayPuzzleId(): Promise<string> {
  const today = await prisma.dailyPuzzle.findFirst({ orderBy: { date: "desc" } });
  if (!today) {
    throw new Error("No DailyPuzzle is published for tests");
  }
  return today.puzzleId;
}

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.GOOGLE_ADMIN_EMAILS = "admin@example.com,password-admin@example.com";
  config = loadConfig();
  googleOAuth.profiles.set("admin", {
    providerSubject: "google-admin-sub",
    email: "admin@example.com",
    displayName: "Admin",
    avatarUrl: null,
  });
  googleOAuth.profiles.set("user", {
    providerSubject: "google-user-sub",
    email: "player@example.com",
    displayName: "Player",
    avatarUrl: "https://example.com/avatar.png",
  });
  googleOAuth.profiles.set("user-again", {
    providerSubject: "google-user-sub",
    email: "other@example.com",
    displayName: "Player",
    avatarUrl: null,
  });
  app = await buildApp({ config, wikipediaProvider: { fetchPage }, googleOAuth, mailer });

  const provider = createArticleProvider("LOCAL");
  const article = (await provider.getArticles())[0]!;
  const scheduledDate = new Date();
  const dateOnly = new Date(
    Date.UTC(scheduledDate.getUTCFullYear(), scheduledDate.getUTCMonth(), scheduledDate.getUTCDate()),
  );
  const dateStr = dateOnly.toISOString().slice(0, 10);
  puzzleId = `puzzle-test-${dateStr}`;

  await prisma.gameResult.deleteMany({});
  await prisma.authToken.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.authIdentity.deleteMany({
    where: { userId: { notIn: ["user-dummy-phase1", "user-local-admin", "user-local-player"] } },
  });
  await prisma.user.deleteMany({
    where: { id: { notIn: ["user-dummy-phase1", "user-local-admin", "user-local-player"] } },
  });
  await prisma.dailyPuzzle.deleteMany({});
  await prisma.puzzle.deleteMany({});
  await getRedis(config).del(`${REDIS_PUZZLE_TODAY_KEY}:${dateStr}`);

  const result = runIngestionPipeline(article, {
    puzzleId,
    puzzleNumber: 99,
    scheduledDate: dateStr,
    generatorVersion: "1.0.0",
  });
  await persistPipelineResult(result, {
    prisma,
    scheduledDate: dateOnly,
    puzzleNumber: 99,
    generatorVersion: "1.0.0",
  });
});

afterAll(async () => {
  const provider = createArticleProvider("LOCAL");
  const article = (await provider.getArticles())[0]!;
  const scheduledDate = new Date();
  const dateOnly = new Date(
    Date.UTC(scheduledDate.getUTCFullYear(), scheduledDate.getUTCMonth(), scheduledDate.getUTCDate()),
  );
  const dateStr = dateOnly.toISOString().slice(0, 10);
  await prisma.gameResult.deleteMany({});
  await prisma.authToken.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.authIdentity.deleteMany({
    where: { userId: { notIn: ["user-dummy-phase1", "user-local-admin", "user-local-player"] } },
  });
  await prisma.user.deleteMany({
    where: { id: { notIn: ["user-dummy-phase1", "user-local-admin", "user-local-player"] } },
  });
  await prisma.dailyPuzzle.deleteMany({});
  await prisma.puzzle.deleteMany({});
  await prisma.article.deleteMany({ where: { source: "WIKIPEDIA" } });
  await getRedis(config).del(`${REDIS_PUZZLE_TODAY_KEY}:${dateStr}`);
  const restored = runIngestionPipeline(article, {
    puzzleId: `puzzle-${dateStr}`,
    puzzleNumber: 1,
    scheduledDate: dateStr,
    generatorVersion: "1.0.0",
  });
  await persistPipelineResult(restored, {
    prisma,
    scheduledDate: dateOnly,
    puzzleNumber: 1,
    generatorVersion: "1.0.0",
  });

  await app.close();
  await disconnectPrisma();
  await disconnectRedis();
  await prisma.$disconnect();
});

describe("backend API", () => {
  it("GET /api/health", async () => {
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });

  it("GET /api/health/dependencies", async () => {
    const res = await app.inject({ method: "GET", url: "/api/health/dependencies" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.dependencies.postgres.status).toBe("ok");
    expect(body.dependencies.redis.status).toBe("ok");
  });

  it("GET /api/puzzles/today returns opaque payload without readable hidden words", async () => {
    const res = await app.inject({ method: "GET", url: "/api/puzzles/today" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBeTruthy();
    expect(body.payload).toBeTruthy();
    expect(body.content).toBeUndefined();
    expect(body.rawContent).toBeUndefined();
    expect(body.title).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("mathematician");
    expect(JSON.stringify(body)).not.toContain("Ada Lovelace");
    expect(body.payload).not.toContain("mathematician");

    const decoded = decodeClientPayload(body.payload);
    expect(decoded.content.some((t) => t.redacted)).toBe(true);
    expect(decoded.titleTokenIds.length).toBeGreaterThan(0);
  });

  it("session sync and terminal recovery", async () => {
    const today = await app.inject({ method: "GET", url: "/api/puzzles/today" });
    const cookie = today.cookies.find((c) => c.name === config.SESSION_COOKIE_NAME);
    expect(cookie?.value).toBeTruthy();

    const sync = await app.inject({
      method: "POST",
      url: "/api/sessions/sync",
      cookies: { [config.SESSION_COOKIE_NAME]: cookie!.value },
      payload: {
        puzzleId: today.json().id,
        attemptId: "attempt-sync-1",
        status: "WON",
        guesses: ["ada", "lovelace"],
        startedAt: Date.now() - 5000,
        completedAt: Date.now(),
      },
    });
    expect(sync.statusCode).toBe(200);
    expect(sync.json().status).toBe("WON");
    expect(sync.json().attemptId).toBe("attempt-sync-1");

    const current = await app.inject({
      method: "GET",
      url: "/api/sessions/current",
      cookies: { [config.SESSION_COOKIE_NAME]: cookie!.value },
    });
    expect(current.statusCode).toBe(200);
    expect(current.json().status).toBe("WON");
  });

  it("game completion is idempotent per attempt and preserves replays", async () => {
    const today = await app.inject({ method: "GET", url: "/api/puzzles/today" });
    const cookie = today.cookies.find((c) => c.name === config.SESSION_COOKIE_NAME);
    const puzzleIdFromApi = today.json().id as string;

    const firstPayload = {
      puzzleId: puzzleIdFromApi,
      attemptId: "attempt-complete-1",
      status: "WON" as const,
      guesses: ["ada", "lovelace"],
      startedAt: Date.now() - 10_000,
      completedAt: Date.now(),
    };

    const first = await app.inject({
      method: "POST",
      url: "/api/games/complete",
      cookies: { [config.SESSION_COOKIE_NAME]: cookie!.value },
      payload: firstPayload,
    });
    expect(first.statusCode).toBe(200);
    expect(first.json().isOfficial).toBe(true);
    expect(first.json().attemptNumber).toBe(1);

    const dup = await app.inject({
      method: "POST",
      url: "/api/games/complete",
      cookies: { [config.SESSION_COOKIE_NAME]: cookie!.value },
      payload: firstPayload,
    });
    expect(dup.json().id).toBe(first.json().id);

    const replay = await app.inject({
      method: "POST",
      url: "/api/games/complete",
      cookies: { [config.SESSION_COOKIE_NAME]: cookie!.value },
      payload: {
        ...firstPayload,
        attemptId: "attempt-complete-2",
        guesses: ["ada", "lovelace", "algorithm"],
      },
    });
    expect(replay.statusCode).toBe(200);
    expect(replay.json().isOfficial).toBe(false);
    expect(replay.json().attemptNumber).toBe(2);

    const count = await prisma.gameResult.count({
      where: { sessionId: cookie!.value, puzzleId: puzzleIdFromApi },
    });
    expect(count).toBe(2);
  });

  it("GET /api/stats uses official results only", async () => {
    const today = await app.inject({ method: "GET", url: "/api/puzzles/today" });
    const cookie = today.cookies.find((c) => c.name === config.SESSION_COOKIE_NAME);
    const puzzleIdFromApi = today.json().id as string;

    await app.inject({
      method: "POST",
      url: "/api/games/complete",
      cookies: { [config.SESSION_COOKIE_NAME]: cookie!.value },
      payload: {
        puzzleId: puzzleIdFromApi,
        attemptId: "attempt-stats-1",
        status: "WON",
        guesses: ["ada", "lovelace"],
        startedAt: Date.now() - 1000,
        completedAt: Date.now(),
      },
    });
    await app.inject({
      method: "POST",
      url: "/api/games/complete",
      cookies: { [config.SESSION_COOKIE_NAME]: cookie!.value },
      payload: {
        puzzleId: puzzleIdFromApi,
        attemptId: "attempt-stats-2",
        status: "WON",
        guesses: ["ada"],
        startedAt: Date.now() - 1000,
        completedAt: Date.now(),
      },
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/stats",
      cookies: { [config.SESSION_COOKIE_NAME]: cookie!.value },
    });
    expect(res.statusCode).toBe(200);
    // Two completions, but only the first is official.
    expect(res.json().gamesPlayed).toBe(1);
    expect(res.json().gamesWon).toBe(1);
  });
});

describe("admin article import API", () => {
  beforeEach(async () => {
    fetchPage.mockReset();
    await prisma.article.deleteMany({ where: { source: "WIKIPEDIA" } });
    adminSession = await newSessionCookie();
    expect((await login(adminSession, "admin")).statusCode).toBe(302);
  });

  it("imports a Wikipedia URL", async () => {
    fetchPage.mockResolvedValue({
      title: "Pet door",
      language: "en",
      revisionId: "123456789",
      canonicalUrl: "https://en.wikipedia.org/wiki/Pet_door",
      wikitext: "A '''pet door''' is a small opening that allows pets to enter a building.",
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/admin/articles/import",
      cookies: cookies(adminSession),
      payload: { url: "https://en.wikipedia.org/wiki/Pet_door" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe("IMPORTED");
    expect(body.article.externalId).toBe("wikipedia:en:Pet_door");
    expect(body.article.title).toBe("Pet door");
    expect(body.article.rawContent).toBeUndefined();
    expect(fetchPage).toHaveBeenCalledOnce();
  });

  it("treats a raw MediaWiki URL as the same article", async () => {
    fetchPage.mockResolvedValue({
      title: "Pet door",
      language: "en",
      revisionId: "123456789",
      canonicalUrl: "https://en.wikipedia.org/wiki/Pet_door",
      wikitext: "A '''pet door''' is a small opening that allows pets to enter a building.",
    });

    const first = await app.inject({
      method: "POST",
      url: "/api/admin/articles/import",
      cookies: cookies(adminSession),
      payload: { url: "https://en.wikipedia.org/wiki/Pet_door" },
    });
    expect(first.json().status).toBe("IMPORTED");

    const second = await app.inject({
      method: "POST",
      url: "/api/admin/articles/import",
      cookies: cookies(adminSession),
      payload: { url: "https://en.wikipedia.org/w/index.php?title=Pet_door&action=raw" },
    });
    expect(second.statusCode).toBe(200);
    expect(second.json().status).toBe("ALREADY_EXISTS");
    expect(second.json().article.id).toBe(first.json().article.id);
    expect(fetchPage).toHaveBeenCalledOnce();
  });

  it("rejects invalid URLs without calling Wikipedia", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/articles/import",
      cookies: cookies(adminSession),
      payload: { url: "https://google.com" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("VALIDATION_ERROR");
    expect(fetchPage).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND for a missing Wikipedia page", async () => {
    fetchPage.mockRejectedValue(
      new WikipediaProviderError("Wikipedia page not found: Missing", "NOT_FOUND", 404),
    );
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/articles/import",
      cookies: cookies(adminSession),
      payload: { url: "https://en.wikipedia.org/wiki/Missing_page_xyz" },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("NOT_FOUND");
  });

  it("maps Wikipedia failures", async () => {
    fetchPage.mockRejectedValue(
      new WikipediaProviderError("Wikipedia API request failed.", "WIKIPEDIA_ERROR", 502),
    );
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/articles/import",
      cookies: cookies(adminSession),
      payload: { url: "https://en.wikipedia.org/wiki/Pet_door" },
    });
    expect(res.statusCode).toBe(502);
    expect(res.json().error.code).toBe("WIKIPEDIA_ERROR");
  });

  it("rejects a malformed request body", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/articles/import",
      cookies: cookies(adminSession),
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("INVALID_REQUEST");
    expect(fetchPage).not.toHaveBeenCalled();
  });

  it("lists article metadata without full content", async () => {
    fetchPage.mockResolvedValue({
      title: "Pet door",
      language: "en",
      revisionId: "123456789",
      canonicalUrl: "https://en.wikipedia.org/wiki/Pet_door",
      wikitext: "A '''pet door''' is a small opening that allows pets to enter a building.",
    });
    await app.inject({
      method: "POST",
      url: "/api/admin/articles/import",
      cookies: cookies(adminSession),
      payload: { url: "https://en.wikipedia.org/wiki/Pet_door" },
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/admin/articles?page=1&pageSize=20",
      cookies: cookies(adminSession),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(20);
    expect(body.total).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(body.items)).toBe(true);
    const pet = body.items.find((item: { externalId: string }) => item.externalId === "wikipedia:en:Pet_door");
    expect(pet).toBeTruthy();
    expect(pet.rawContent).toBeUndefined();
    expect(pet.sourceWikitext).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("small opening");
  });
});

describe("admin article play API", () => {
  beforeEach(async () => {
    fetchPage.mockReset();
    await prisma.article.deleteMany({ where: { source: "WIKIPEDIA" } });
    adminSession = await newSessionCookie();
    expect((await login(adminSession, "admin")).statusCode).toBe(302);
  });

  it("generates an opaque puzzle from a stored article id without persisting a Puzzle", async () => {
    const puzzleCountBefore = await prisma.puzzle.count();
    const todayBefore = await app.inject({ method: "GET", url: "/api/puzzles/today" });
    expect(todayBefore.statusCode).toBe(200);
    const todayId = todayBefore.json().id as string;

    const res = await app.inject({
      method: "GET",
      url: "/api/admin/articles/article-ada-lovelace/puzzle",
      cookies: cookies(adminSession),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe("admin-play-article-ada-lovelace");
    expect(body.puzzleNumber).toBe(0);
    expect(body.payload).toBeTruthy();
    expect(body.content).toBeUndefined();
    expect(body.rawContent).toBeUndefined();
    expect(body.title).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("mathematician");
    expect(JSON.stringify(body)).not.toContain("Ada Lovelace");

    const decoded = decodeClientPayload(body.payload);
    expect(decoded.puzzleId).toBe("admin-play-article-ada-lovelace");
    expect(decoded.content.some((t) => t.redacted)).toBe(true);
    expect(decoded.titleTokenIds.length).toBeGreaterThan(0);

    expect(await prisma.puzzle.count()).toBe(puzzleCountBefore);
    const todayAfter = await app.inject({ method: "GET", url: "/api/puzzles/today" });
    expect(todayAfter.json().id).toBe(todayId);
  });

  it("looks up a stored article by externalId", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/admin/articles/${encodeURIComponent("local:ada-lovelace")}/puzzle`,
      cookies: cookies(adminSession),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe("admin-play-article-ada-lovelace");
  });

  it("generates a puzzle from an imported Wikipedia article", async () => {
    fetchPage.mockResolvedValue({
      title: "Pet door",
      language: "en",
      revisionId: "123456789",
      canonicalUrl: "https://en.wikipedia.org/wiki/Pet_door",
      wikitext:
        "A '''pet door''' or cat flap is an opening in a door, wall, or window that allows pets to enter and leave a building without human assistance. Pet doors may include magnetic flaps, electronic sensors, or hanging panels. Designers consider weather, predators, insulation, and installation when choosing a pet door.",
    });
    const imported = await app.inject({
      method: "POST",
      url: "/api/admin/articles/import",
      cookies: cookies(adminSession),
      payload: { url: "https://en.wikipedia.org/wiki/Pet_door" },
    });
    const articleId = imported.json().article.id as string;

    const res = await app.inject({
      method: "GET",
      url: `/api/admin/articles/${articleId}/puzzle`,
      cookies: cookies(adminSession),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe(`admin-play-${articleId}`);
    expect(body.rawContent).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("small opening");

    const decoded = decodeClientPayload(body.payload);
    expect(decoded.content.some((t) => t.redacted)).toBe(true);
    expect(decoded.title.toLowerCase()).toContain("pet");
    expect(decoded.title.toLowerCase()).toBe("pet door");
  });

  it("returns ARTICLE_NOT_FOUND for an unknown id", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/admin/articles/missing-article/puzzle",
      cookies: cookies(adminSession),
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("ARTICLE_NOT_FOUND");
  });
});

describe("puzzle pool API", () => {
  beforeEach(async () => {
    adminSession = await newSessionCookie();
    expect((await login(adminSession, "admin")).statusCode).toBe(302);
  });

  it("lists puzzles without exposing article plaintext", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/admin/puzzles",
      cookies: cookies(adminSession),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBeGreaterThanOrEqual(1);
    expect(body.items[0].status).toBeTruthy();
    expect(JSON.stringify(body)).not.toContain("mathematician");
    expect(body.items[0].rawContent).toBeUndefined();
  });

  it("generate is idempotent for the same article and generator version", async () => {
    const first = await app.inject({
      method: "POST",
      url: "/api/admin/puzzles/generate",
      cookies: cookies(adminSession),
      payload: { articleId: "article-ada-lovelace" },
    });
    expect(first.statusCode).toBe(200);
    expect(["GENERATED", "ALREADY_EXISTS"]).toContain(first.json().status);

    const second = await app.inject({
      method: "POST",
      url: "/api/admin/puzzles/generate",
      cookies: cookies(adminSession),
      payload: { articleId: "article-ada-lovelace" },
    });
    expect(second.statusCode).toBe(200);
    expect(second.json().status).toBe("ALREADY_EXISTS");
  });

  it("publish-today is idempotent and /today uses DailyPuzzle", async () => {
    const first = await app.inject({
      method: "POST",
      url: "/api/admin/puzzles/publish-today",
      cookies: cookies(adminSession),
    });
    expect(first.statusCode).toBe(200);
    expect(["PUBLISHED", "ALREADY_PUBLISHED"]).toContain(first.json().status);

    const second = await app.inject({
      method: "POST",
      url: "/api/admin/puzzles/publish-today",
      cookies: cookies(adminSession),
    });
    expect(second.statusCode).toBe(200);
    expect(second.json().status).toBe("ALREADY_PUBLISHED");
    expect(second.json().puzzleId).toBe(first.json().puzzleId);

    const today = await app.inject({ method: "GET", url: "/api/puzzles/today" });
    expect(today.statusCode).toBe(200);
    expect(today.json().id).toBe(first.json().puzzleId);
    expect(today.json().content).toBeUndefined();
    expect(today.json().rawContent).toBeUndefined();
    expect(today.json().title).toBeUndefined();
    expect(JSON.stringify(today.json())).not.toContain("mathematician");
  });
});

describe("authentication and authorization", () => {
  beforeEach(async () => {
    await prisma.gameResult.deleteMany({});
  });  async function completeOfficial(sessionId: string, attemptId: string, status: "WON" | "GAVE_UP" = "WON") {
    const today = await app.inject({ method: "GET", url: "/api/puzzles/today" });
    return app.inject({
      method: "POST",
      url: "/api/games/complete",
      cookies: cookies(sessionId),
      payload: {
        puzzleId: today.json().id,
        attemptId,
        status,
        guesses: status === "WON" ? ["ada", "lovelace"] : ["ada"],
        startedAt: Date.now() - 5000,
        completedAt: Date.now(),
      },
    });
  }

  it("creates a user on first Google login and reuses the provider subject", async () => {
    const sessionId = await newSessionCookie();
    const first = await login(sessionId, "user");
    expect(first.statusCode).toBe(302);

    const me = await app.inject({ method: "GET", url: "/api/me", cookies: cookies(sessionId) });
    expect(me.statusCode).toBe(200);
    expect(me.json().email).toBe("player@example.com");
    expect(me.json().role).toBe("USER");
    const userId = me.json().id as string;

    const identities = await prisma.authIdentity.findMany({
      where: { provider: "GOOGLE", providerSubject: "google-user-sub" },
    });
    expect(identities).toHaveLength(1);

    const session2 = await newSessionCookie();
    const second = await login(session2, "user-again");
    expect(second.statusCode).toBe(302);
    const me2 = await app.inject({ method: "GET", url: "/api/me", cookies: cookies(session2) });
    expect(me2.json().id).toBe(userId);
    expect(me2.json().email).toBe("other@example.com");
    expect(await prisma.user.count({ where: { identities: { some: { providerSubject: "google-user-sub" } } } })).toBe(1);
  });

  it("keeps multiple sessions authenticated independently", async () => {
    const desktop = await newSessionCookie();
    const mobile = await newSessionCookie();
    expect((await login(desktop, "user")).statusCode).toBe(302);
    expect((await login(mobile, "user")).statusCode).toBe(302);

    expect((await app.inject({ method: "GET", url: "/api/me", cookies: cookies(desktop) })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/api/me", cookies: cookies(mobile) })).statusCode).toBe(200);

    const logout = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      cookies: cookies(desktop),
    });
    expect(logout.statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/api/me", cookies: cookies(desktop) })).statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: "/api/me", cookies: cookies(mobile) })).statusCode).toBe(200);

    const today = await app.inject({ method: "GET", url: "/api/puzzles/today", cookies: cookies(desktop) });
    expect(today.statusCode).toBe(200);
  });

  it("rejects an invalid OAuth callback", async () => {
    const sessionId = await newSessionCookie();
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/google/callback?code=nope&state=unknown",
      cookies: cookies(sessionId),
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("INVALID_OAUTH_STATE");
  });

  it("requires authentication for /api/me and admin for /api/admin", async () => {
    const anonymous = await app.inject({ method: "GET", url: "/api/me" });
    expect(anonymous.statusCode).toBe(401);

    const today = await app.inject({ method: "GET", url: "/api/puzzles/today" });
    expect(today.statusCode).toBe(200);

    const adminAnon = await app.inject({ method: "GET", url: "/api/admin/puzzles" });
    expect(adminAnon.statusCode).toBe(401);

    const userSession = await newSessionCookie();
    expect((await login(userSession, "user")).statusCode).toBe(302);
    const adminUser = await app.inject({
      method: "GET",
      url: "/api/admin/puzzles",
      cookies: cookies(userSession),
    });
    expect(adminUser.statusCode).toBe(403);

    const admin = await newSessionCookie();
    expect((await login(admin, "admin")).statusCode).toBe(302);
    const adminOk = await app.inject({
      method: "GET",
      url: "/api/admin/puzzles",
      cookies: cookies(admin),
    });
    expect(adminOk.statusCode).toBe(200);
  });

  it("preserves an in-progress game and claims anonymous results", async () => {
    const sessionId = await newSessionCookie();
    const today = await app.inject({ method: "GET", url: "/api/puzzles/today" });
    const puzzleIdFromApi = today.json().id as string;

    const sync = await app.inject({
      method: "POST",
      url: "/api/sessions/sync",
      cookies: cookies(sessionId),
      payload: {
        puzzleId: puzzleIdFromApi,
        attemptId: "attempt-live",
        status: "IN_PROGRESS",
        guesses: ["english"],
        startedAt: Date.now() - 1000,
      },
    });
    expect(sync.statusCode).toBe(200);

    expect((await login(sessionId, "user")).statusCode).toBe(302);
    const current = await app.inject({
      method: "GET",
      url: "/api/sessions/current",
      cookies: cookies(sessionId),
    });
    expect(current.json().guesses).toEqual(["english"]);
    expect(current.json().attemptId).toBe("attempt-live");
    expect(current.json().userId).toBeTruthy();

    await completeOfficial(sessionId, "attempt-live-win");
    const stats = await app.inject({
      method: "GET",
      url: "/api/me/stats",
      cookies: cookies(sessionId),
    });
    expect(stats.statusCode).toBe(200);
    expect(stats.json().gamesWon).toBeGreaterThanOrEqual(1);
  });

  it("claims an anonymous WON result without duplicating user+puzzle", async () => {
    const sessionId = await newSessionCookie();
    const completed = await completeOfficial(sessionId, "attempt-claim-won");
    expect(completed.json().isOfficial).toBe(true);
    expect((await login(sessionId, "user")).statusCode).toBe(302);

    const row = await prisma.gameResult.findFirst({
      where: { sessionId, attemptId: "attempt-claim-won" },
    });
    expect(row?.userId).toBeTruthy();
    expect(row?.isOfficial).toBe(true);

    expect((await login(sessionId, "user")).statusCode).toBe(302);
    const officialCount = await prisma.gameResult.count({
      where: { userId: row!.userId!, puzzleId: row!.puzzleId, isOfficial: true },
    });
    expect(officialCount).toBe(1);

    const stats = await app.inject({
      method: "GET",
      url: "/api/me/stats",
      cookies: cookies(sessionId),
    });
    expect(stats.json().gamesWon).toBeGreaterThanOrEqual(1);
  });

  it("claims an anonymous GAVE_UP result", async () => {
    const sessionId = await newSessionCookie();
    await completeOfficial(sessionId, "attempt-claim-giveup", "GAVE_UP");
    expect((await login(sessionId, "user")).statusCode).toBe(302);
    const row = await prisma.gameResult.findFirst({
      where: { sessionId, attemptId: "attempt-claim-giveup" },
    });
    expect(row?.userId).toBeTruthy();
    expect(row?.status).toBe("GAVE_UP");
  });

  it("discards an anonymous official result when the user already has one", async () => {
    const firstSession = await newSessionCookie();
    await completeOfficial(firstSession, "attempt-first-official");
    expect((await login(firstSession, "user")).statusCode).toBe(302);
    const user = await app.inject({ method: "GET", url: "/api/me", cookies: cookies(firstSession) });
    const userId = user.json().id as string;
    const today = await app.inject({ method: "GET", url: "/api/puzzles/today" });

    const secondSession = await newSessionCookie();
    await completeOfficial(secondSession, "attempt-second-official");
    expect((await login(secondSession, "user")).statusCode).toBe(302);

    const official = await prisma.gameResult.findMany({
      where: { userId, puzzleId: today.json().id as string, isOfficial: true },
    });
    expect(official).toHaveLength(1);

    const discarded = await prisma.gameResult.findFirst({
      where: { sessionId: secondSession, attemptId: "attempt-second-official" },
    });
    expect(discarded?.isOfficial).toBe(false);
    expect(discarded?.userId).toBeNull();
  });

  it("does not count replay toward user stats", async () => {
    const sessionId = await newSessionCookie();
    expect((await login(sessionId, "user")).statusCode).toBe(302);
    const first = await completeOfficial(sessionId, "attempt-stats-official");
    expect(first.json().isOfficial).toBe(true);
    const before = await app.inject({
      method: "GET",
      url: "/api/me/stats",
      cookies: cookies(sessionId),
    });
    const replay = await completeOfficial(sessionId, "attempt-stats-replay");
    expect(replay.json().isOfficial).toBe(false);
    const after = await app.inject({
      method: "GET",
      url: "/api/me/stats",
      cookies: cookies(sessionId),
    });
    expect(after.json().gamesPlayed).toBe(before.json().gamesPlayed);
    expect(after.json().gamesWon).toBe(before.json().gamesWon);
    expect(after.json().currentStreak).toBe(before.json().currentStreak);
  });

  it("updates stored PuzzleStats only for official daily completes", async () => {
    const sessionId = await newSessionCookie();
    const first = await completeOfficial(sessionId, "attempt-pstats-1");
    const stats = first.json().puzzleStats as {
      gamesPlayed: number;
      gamesWon: number;
      medianGuessCount: number | null;
      guessHistogram: Record<string, number>;
      title?: string;
    };
    expect(first.json().isOfficial).toBe(true);
    expect(first.json().source).toBe("DAILY");
    expect(stats.gamesPlayed).toBe(1);
    expect(stats.gamesWon).toBe(1);
    expect(stats.medianGuessCount).toBe(2);
    expect(stats.guessHistogram["2"]).toBe(1);
    expect(stats.title).toBeUndefined();

    const replay = await completeOfficial(sessionId, "attempt-pstats-replay");
    expect(replay.json().isOfficial).toBe(false);
    expect(replay.json().puzzleStats.gamesPlayed).toBe(1);

    const completedPuzzleId = first.json().puzzleId as string;
    const stored = await prisma.puzzleStats.findUnique({ where: { puzzleId: completedPuzzleId } });
    expect(stored?.gamesPlayed).toBe(1);

    const fetched = await app.inject({
      method: "GET",
      url: `/api/puzzles/${completedPuzzleId}/stats`,
      cookies: cookies(sessionId),
    });
    expect(fetched.statusCode).toBe(200);
    expect(fetched.json().gamesPlayed).toBe(1);
  });

  it("does not attach anonymous results to a user who never logs in on that session", async () => {
    const anonymous = await newSessionCookie();
    await completeOfficial(anonymous, "attempt-never-login");
    const other = await newSessionCookie();
    expect((await login(other, "user")).statusCode).toBe(302);
    const stats = await app.inject({
      method: "GET",
      url: "/api/me/stats",
      cookies: cookies(other),
    });
    const claimed = await prisma.gameResult.findFirst({
      where: { sessionId: anonymous, attemptId: "attempt-never-login" },
    });
    expect(claimed?.userId).toBeNull();
    const me = await app.inject({ method: "GET", url: "/api/me", cookies: cookies(other) });
    expect(
      await prisma.gameResult.count({
        where: { userId: me.json().id as string, attemptId: "attempt-never-login" },
      }),
    ).toBe(0);
    expect(stats.statusCode).toBe(200);
  });

  it("accepts logout with an empty JSON content-type", async () => {
    const sessionId = await newSessionCookie();
    expect((await login(sessionId, "user")).statusCode).toBe(302);
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      cookies: cookies(sessionId),
      headers: { "content-type": "application/json" },
      payload: "",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect((await app.inject({ method: "GET", url: "/api/me", cookies: cookies(sessionId) })).statusCode).toBe(401);
  });

  it("registers and logs in with email/password and assigns ADMIN from the allowlist", async () => {
    const sessionId = await newSessionCookie();
    const registered = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      cookies: cookies(sessionId),
      payload: {
        email: "role-user@example.com",
        password: "password123",
        displayName: "Role User",
      },
    });
    expect(registered.statusCode).toBe(200);
    expect(registered.json().email).toBe("role-user@example.com");
    expect(registered.json().role).toBe("USER");

    const duplicate = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      cookies: cookies(sessionId),
      payload: { email: "role-user@example.com", password: "password123" },
    });
    expect(duplicate.statusCode).toBe(409);

    await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      cookies: cookies(sessionId),
      headers: { "content-type": "application/json" },
    });

    const bad = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      cookies: cookies(sessionId),
      payload: { email: "role-user@example.com", password: "wrong-password" },
    });
    expect(bad.statusCode).toBe(401);

    const ok = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      cookies: cookies(sessionId),
      payload: { email: "role-user@example.com", password: "password123" },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().id).toBe(registered.json().id);

    const adminSession = await newSessionCookie();
    const admin = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      cookies: cookies(adminSession),
      payload: { email: "password-admin@example.com", password: "password123" },
    });
    expect(admin.statusCode).toBe(200);
    expect(admin.json().role).toBe("ADMIN");
    const adminApi = await app.inject({
      method: "GET",
      url: "/api/admin/puzzles",
      cookies: cookies(adminSession),
    });
    expect(adminApi.statusCode).toBe(200);
  });
});

describe("phase 5 archive, history, and accounts", () => {
  beforeEach(async () => {
    await prisma.gameResult.deleteMany({});
    await prisma.authToken.deleteMany({});
    mailer.messages.length = 0;
    await prisma.dailyPuzzle.deleteMany({ where: { puzzleId: { startsWith: "puzzle-archive-" } } });
    await prisma.puzzle.deleteMany({ where: { id: { startsWith: "puzzle-archive-" } } });
  });

  async function createArchivePuzzle(daysAgo: number, puzzleNumber: number): Promise<string> {
    const source = await prisma.puzzle.findUniqueOrThrow({ where: { id: await todayPuzzleId() } });
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - daysAgo);
    const dateOnly = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const archiveId = `puzzle-archive-${puzzleNumber}`;
    const clientPuzzleData = {
      ...(source.clientPuzzleData as Record<string, unknown>),
      id: archiveId,
      puzzleNumber,
    };
    await prisma.puzzle.create({
      data: {
        id: archiveId,
        articleId: source.articleId,
        puzzleNumber,
        scheduledDate: dateOnly,
        generatorVersion: source.generatorVersion,
        clientPuzzleData,
        status: "PUBLISHED",
        title: source.title,
        titleMatchKey: source.titleMatchKey,
        wordCount: source.wordCount,
        guessableWordCount: source.guessableWordCount,
        uniqueGuessableWordCount: source.uniqueGuessableWordCount,
        titleTokenCount: source.titleTokenCount,
        publishedAt: dateOnly,
      },
    });
    await prisma.dailyPuzzle.create({
      data: { date: dateOnly, puzzleId: archiveId, publishedAt: dateOnly },
    });
    return archiveId;
  }

  function lastMailToken(): string {
    const text = mailer.messages.at(-1)?.text ?? "";
    const match = text.match(/token=([a-f0-9]+)/);
    if (!match) {
      throw new Error(`No token in mail: ${text}`);
    }
    return match[1]!;
  }

  it("lists public archive newest-first without today or article plaintext", async () => {
    const older = await createArchivePuzzle(2, 97);
    const newer = await createArchivePuzzle(1, 98);
    const anonymous = await app.inject({ method: "GET", url: "/api/puzzles/archive?page=1&pageSize=10" });
    expect(anonymous.statusCode).toBe(200);
    const body = anonymous.json();
    expect(body.items.map((item: { puzzleId: string }) => item.puzzleId)).toEqual([newer, older]);
    const todayId = await todayPuzzleId();
    expect(body.items.every((item: { puzzleId: string }) => item.puzzleId !== todayId)).toBe(true);
    expect(JSON.stringify(body)).not.toContain("Ada Lovelace");
    expect(JSON.stringify(body)).not.toContain("mathematician");
    expect(body.items[0].title).toBeUndefined();
    expect(body.items[0].payload).toBeUndefined();

    const page1 = await app.inject({ method: "GET", url: "/api/puzzles/archive?page=1&pageSize=1" });
    expect(page1.json().items).toHaveLength(1);
    expect(page1.json().items[0].puzzleId).toBe(newer);
    expect(page1.json().total).toBe(2);

    await prisma.dailyPuzzle.deleteMany({ where: { puzzleId: { in: [older, newer] } } });
    await prisma.puzzle.deleteMany({ where: { id: { in: [older, newer] } } });
  });

  it("returns a safe archive puzzle and official result for the current identity", async () => {
    const archiveId = await createArchivePuzzle(1, 96);
    const sessionId = await newSessionCookie();
    const puzzle = await app.inject({
      method: "GET",
      url: `/api/puzzles/archive/${archiveId}`,
      cookies: cookies(sessionId),
    });
    expect(puzzle.statusCode).toBe(200);
    expect(puzzle.json().id).toBe(archiveId);
    expect(puzzle.json().payload).toBeTruthy();
    expect(puzzle.json().title).toBeUndefined();
    expect(puzzle.json().rawContent).toBeUndefined();
    expect(puzzle.json().officialResult).toBeNull();
    expect(JSON.stringify(puzzle.json())).not.toContain("Ada Lovelace");

    await app.inject({
      method: "POST",
      url: "/api/games/complete",
      cookies: cookies(sessionId),
      payload: {
        puzzleId: archiveId,
        attemptId: "archive-official",
        status: "WON",
        guesses: ["ada", "lovelace"],
        startedAt: Date.now() - 5000,
        completedAt: Date.now(),
      },
    });
    const again = await app.inject({
      method: "GET",
      url: `/api/puzzles/archive/${archiveId}`,
      cookies: cookies(sessionId),
    });
    expect(again.json().officialResult.isOfficial).toBe(true);
    expect(again.json().officialResult.source).toBe("ARCHIVE");

    await prisma.gameResult.deleteMany({ where: { puzzleId: archiveId } });
    await prisma.dailyPuzzle.delete({ where: { puzzleId: archiveId } });
    await prisma.puzzle.delete({ where: { id: archiveId } });
  });

  it("treats archive first attempts as official stats without changing streak", async () => {
    const archiveId = await createArchivePuzzle(1, 95);
    const sessionId = await newSessionCookie();
    const registered = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      cookies: cookies(sessionId),
      payload: { email: "archive-player@example.com", password: "password123" },
    });
    expect(registered.statusCode).toBe(200);

    const archiveWin = await app.inject({
      method: "POST",
      url: "/api/games/complete",
      cookies: cookies(sessionId),
      payload: {
        puzzleId: archiveId,
        attemptId: "archive-first",
        status: "WON",
        guesses: ["ada", "lovelace"],
        startedAt: Date.now() - 4000,
        completedAt: Date.now(),
      },
    });
    expect(archiveWin.json().isOfficial).toBe(true);
    expect(archiveWin.json().source).toBe("ARCHIVE");

    const afterArchive = await app.inject({
      method: "GET",
      url: "/api/me/stats",
      cookies: cookies(sessionId),
    });
    expect(afterArchive.json().gamesPlayed).toBe(1);
    expect(afterArchive.json().gamesWon).toBe(1);
    expect(afterArchive.json().currentStreak).toBe(0);

    const todayWin = await app.inject({
      method: "POST",
      url: "/api/games/complete",
      cookies: cookies(sessionId),
      payload: {
        puzzleId: await todayPuzzleId(),
        attemptId: "daily-first",
        status: "WON",
        guesses: ["ada", "lovelace"],
        startedAt: Date.now() - 3000,
        completedAt: Date.now(),
      },
    });
    expect(todayWin.json().isOfficial).toBe(true);
    expect(todayWin.json().source).toBe("DAILY");

    const afterDaily = await app.inject({
      method: "GET",
      url: "/api/me/stats",
      cookies: cookies(sessionId),
    });
    expect(afterDaily.json().gamesPlayed).toBe(2);
    expect(afterDaily.json().currentStreak).toBe(1);

    const replay = await app.inject({
      method: "POST",
      url: "/api/games/complete",
      cookies: cookies(sessionId),
      payload: {
        puzzleId: archiveId,
        attemptId: "archive-replay",
        status: "WON",
        guesses: ["ada"],
        startedAt: Date.now() - 1000,
        completedAt: Date.now(),
      },
    });
    expect(replay.json().isOfficial).toBe(false);
    const afterReplay = await app.inject({
      method: "GET",
      url: "/api/me/stats",
      cookies: cookies(sessionId),
    });
    expect(afterReplay.json().gamesPlayed).toBe(2);
    expect(afterReplay.json().currentStreak).toBe(1);

    const history = await app.inject({
      method: "GET",
      url: "/api/me/history?page=1&pageSize=20",
      cookies: cookies(sessionId),
    });
    expect(history.statusCode).toBe(200);
    expect(history.json().total).toBe(2);
    expect(history.json().items.every((item: { source: string }) => item.source)).toBeTruthy();
    expect(JSON.stringify(history.json())).not.toContain("Ada Lovelace");

    await prisma.gameResult.deleteMany({ where: { puzzleId: archiveId } });
    await prisma.dailyPuzzle.delete({ where: { puzzleId: archiveId } });
    await prisma.puzzle.delete({ where: { id: archiveId } });
  });

  it("keeps history private and paginated", async () => {
    const anonymous = await app.inject({ method: "GET", url: "/api/me/history" });
    expect(anonymous.statusCode).toBe(401);

    const sessionId = await newSessionCookie();
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      cookies: cookies(sessionId),
      payload: { email: "history-owner@example.com", password: "password123" },
    });
    await app.inject({
      method: "POST",
      url: "/api/games/complete",
      cookies: cookies(sessionId),
      payload: {
        puzzleId: await todayPuzzleId(),
        attemptId: "history-official",
        status: "WON",
        guesses: ["ada", "lovelace"],
        startedAt: Date.now() - 2000,
        completedAt: Date.now(),
      },
    });
    const owner = await app.inject({
      method: "GET",
      url: "/api/me/history?page=1&pageSize=1",
      cookies: cookies(sessionId),
    });
    expect(owner.statusCode).toBe(200);
    expect(owner.json().items).toHaveLength(1);

    const other = await newSessionCookie();
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      cookies: cookies(other),
      payload: { email: "history-other@example.com", password: "password123" },
    });
    const otherHistory = await app.inject({
      method: "GET",
      url: "/api/me/history",
      cookies: cookies(other),
    });
    expect(otherHistory.json().total).toBe(0);
  });

  it("claims an anonymous archive win without changing streak", async () => {
    const archiveId = await createArchivePuzzle(1, 94);
    const sessionId = await newSessionCookie();
    const completed = await app.inject({
      method: "POST",
      url: "/api/games/complete",
      cookies: cookies(sessionId),
      payload: {
        puzzleId: archiveId,
        attemptId: "anon-archive",
        status: "WON",
        guesses: ["ada", "lovelace"],
        startedAt: Date.now() - 2000,
        completedAt: Date.now(),
      },
    });
    expect(completed.json().isOfficial).toBe(true);
    expect(completed.json().source).toBe("ARCHIVE");
    expect(completed.json().puzzleStats.gamesPlayed).toBe(0);
    expect(await prisma.puzzleStats.findUnique({ where: { puzzleId: archiveId } })).toBeNull();

    const login = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      cookies: cookies(sessionId),
      payload: { email: "claim-archive@example.com", password: "password123" },
    });
    expect(login.statusCode).toBe(200);
    const history = await app.inject({
      method: "GET",
      url: "/api/me/history",
      cookies: cookies(sessionId),
    });
    expect(history.json().total).toBe(1);
    const stats = await app.inject({
      method: "GET",
      url: "/api/me/stats",
      cookies: cookies(sessionId),
    });
    expect(stats.json().gamesWon).toBe(1);
    expect(stats.json().currentStreak).toBe(0);

    await prisma.gameResult.deleteMany({ where: { puzzleId: archiveId } });
    await prisma.dailyPuzzle.delete({ where: { puzzleId: archiveId } });
    await prisma.puzzle.delete({ where: { id: archiveId } });
  });

  it("verifies email with a single-use token and does not leak forgot-password existence", async () => {
    const sessionId = await newSessionCookie();
    const registered = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      cookies: cookies(sessionId),
      payload: { email: "verify-me@example.com", password: "password123" },
    });
    expect(registered.json().emailVerified).toBe(false);
    const token = lastMailToken();

    const expired = await app.inject({
      method: "POST",
      url: "/api/auth/email/verify",
      payload: { token: "deadbeef" },
    });
    expect(expired.statusCode).toBe(400);

    await prisma.authToken.update({
      where: { tokenHash: hashAuthToken(token) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const stale = await app.inject({
      method: "POST",
      url: "/api/auth/email/verify",
      payload: { token },
    });
    expect(stale.statusCode).toBe(400);

    mailer.messages.length = 0;
    await app.inject({
      method: "POST",
      url: "/api/auth/email/resend",
      cookies: cookies(sessionId),
    });
    const fresh = lastMailToken();
    const verified = await app.inject({
      method: "POST",
      url: "/api/auth/email/verify",
      payload: { token: fresh },
    });
    expect(verified.statusCode).toBe(200);
    expect(verified.json().emailVerified).toBe(true);
    const reused = await app.inject({
      method: "POST",
      url: "/api/auth/email/verify",
      payload: { token: fresh },
    });
    expect(reused.statusCode).toBe(400);

    const missing = await app.inject({
      method: "POST",
      url: "/api/auth/password/forgot",
      payload: { email: "no-such-user@example.com" },
    });
    const existing = await app.inject({
      method: "POST",
      url: "/api/auth/password/forgot",
      payload: { email: "verify-me@example.com" },
    });
    expect(missing.json().message).toBe(existing.json().message);
    expect(missing.statusCode).toBe(200);
  });

  it("resets a password, invalidates sessions, and rejects Google-only password changes", async () => {
    const sessionId = await newSessionCookie();
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      cookies: cookies(sessionId),
      payload: { email: "reset-me@example.com", password: "password123" },
    });
    mailer.messages.length = 0;
    await app.inject({
      method: "POST",
      url: "/api/auth/password/forgot",
      payload: { email: "reset-me@example.com" },
    });
    const token = lastMailToken();
    const reset = await app.inject({
      method: "POST",
      url: "/api/auth/password/reset",
      payload: { token, password: "newpassword123" },
    });
    expect(reset.statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/api/me", cookies: cookies(sessionId) })).statusCode).toBe(401);
    const reused = await app.inject({
      method: "POST",
      url: "/api/auth/password/reset",
      payload: { token, password: "anotherpass123" },
    });
    expect(reused.statusCode).toBe(400);

    const relogin = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      cookies: cookies(sessionId),
      payload: { email: "reset-me@example.com", password: "newpassword123" },
    });
    expect(relogin.statusCode).toBe(200);

    const wrong = await app.inject({
      method: "POST",
      url: "/api/me/password/change",
      cookies: cookies(sessionId),
      payload: { currentPassword: "nope", newPassword: "changedpass1" },
    });
    expect(wrong.statusCode).toBe(401);
    const changed = await app.inject({
      method: "POST",
      url: "/api/me/password/change",
      cookies: cookies(sessionId),
      payload: { currentPassword: "newpassword123", newPassword: "changedpass1" },
    });
    expect(changed.statusCode).toBe(200);

    const googleSession = await newSessionCookie();
    expect((await login(googleSession, "user")).statusCode).toBe(302);
    const googleChange = await app.inject({
      method: "POST",
      url: "/api/me/password/change",
      cookies: cookies(googleSession),
      payload: { currentPassword: "anything1", newPassword: "changedpass1" },
    });
    expect(googleChange.statusCode).toBe(400);
    expect(googleChange.json().error.code).toBe("NO_PASSWORD");
  });

  it("updates a profile and deletes only personal account data", async () => {
    const sessionId = await newSessionCookie();
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      cookies: cookies(sessionId),
      payload: { email: "delete-me@example.com", password: "password123", displayName: "Doomed" },
    });
    const patched = await app.inject({
      method: "PATCH",
      url: "/api/me/profile",
      cookies: cookies(sessionId),
      payload: { displayName: "Renamed" },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json().displayName).toBe("Renamed");

    await app.inject({
      method: "POST",
      url: "/api/games/complete",
      cookies: cookies(sessionId),
      payload: {
        puzzleId: await todayPuzzleId(),
        attemptId: "delete-official",
        status: "WON",
        guesses: ["ada", "lovelace"],
        startedAt: Date.now() - 1000,
        completedAt: Date.now(),
      },
    });
    const userId = patched.json().id as string;
    const deleted = await app.inject({
      method: "DELETE",
      url: "/api/me",
      cookies: cookies(sessionId),
      payload: { confirm: "DELETE", password: "password123" },
    });
    expect(deleted.statusCode).toBe(200);
    expect(await prisma.user.findUnique({ where: { id: userId } })).toBeNull();
    expect(await prisma.gameResult.count({ where: { userId } })).toBe(0);
    expect(await prisma.puzzle.findUnique({ where: { id: await todayPuzzleId() } })).toBeTruthy();
    expect(await prisma.dailyPuzzle.count()).toBeGreaterThan(0);
  });
});

describe("phase 6 scoring and leaderboard", () => {
  beforeEach(async () => {
    await prisma.gameResult.deleteMany({});
  });

  it("computes hit guesses and a versioned score for official wins", async () => {
    const sessionId = await newSessionCookie();
    const completed = await app.inject({
      method: "POST",
      url: "/api/games/complete",
      cookies: cookies(sessionId),
      payload: {
        puzzleId: await todayPuzzleId(),
        attemptId: "score-official",
        status: "WON",
        guesses: ["ada", "lovelace", "zzzz"],
        startedAt: Date.now() - 5_000,
        completedAt: Date.now(),
        score: 1,
      },
    });
    expect(completed.statusCode).toBe(200);
    const body = completed.json();
    expect(body.hitGuessCount).toBe(2);
    expect(body.guessAccuracy).toBeCloseTo(2 / 3);
    expect(body.scoreVersion).toBe(1);
    expect(body.score).toBeGreaterThan(0);
    expect(body.score).not.toBe(1);
  });

  it("does not persist a competitive score for give-up or replay", async () => {
    const sessionId = await newSessionCookie();
    const puzzle = await todayPuzzleId();
    const gaveUp = await app.inject({
      method: "POST",
      url: "/api/games/complete",
      cookies: cookies(sessionId),
      payload: {
        puzzleId: puzzle,
        attemptId: "score-give-up",
        status: "GAVE_UP",
        guesses: ["ada"],
        startedAt: Date.now() - 5_000,
        completedAt: Date.now(),
      },
    });
    expect(gaveUp.json().score).toBe(0);
    expect(gaveUp.json().scoreVersion).toBe(0);

    const replaySession = await newSessionCookie();
    await app.inject({
      method: "POST",
      url: "/api/games/complete",
      cookies: cookies(replaySession),
      payload: {
        puzzleId: puzzle,
        attemptId: "score-first",
        status: "WON",
        guesses: ["ada", "lovelace"],
        startedAt: Date.now() - 5_000,
        completedAt: Date.now(),
      },
    });
    const replay = await app.inject({
      method: "POST",
      url: "/api/games/complete",
      cookies: cookies(replaySession),
      payload: {
        puzzleId: puzzle,
        attemptId: "score-replay",
        status: "WON",
        guesses: ["ada", "lovelace"],
        startedAt: Date.now() - 5_000,
        completedAt: Date.now(),
      },
    });
    expect(replay.json().isOfficial).toBe(false);
    expect(replay.json().score).toBe(0);
    expect(replay.json().scoreVersion).toBe(0);
  });

  it("keeps anonymous official daily wins off today's leaderboard", async () => {
    const sessionId = await newSessionCookie();
    await app.inject({
      method: "POST",
      url: "/api/games/complete",
      cookies: cookies(sessionId),
      payload: {
        puzzleId: await todayPuzzleId(),
        attemptId: "lb-anon",
        status: "WON",
        guesses: ["ada", "lovelace"],
        startedAt: Date.now() - 5_000,
        completedAt: Date.now(),
      },
    });
    const board = await app.inject({
      method: "GET",
      url: "/api/leaderboard/today",
      cookies: cookies(sessionId),
    });
    expect(board.statusCode).toBe(200);
    expect(board.json().authenticated).toBe(false);
    expect(board.json().entries).toEqual([]);
    expect(board.json().me).toBeNull();
    expect(JSON.stringify(board.json())).not.toContain("player@example.com");
  });

  it("includes authenticated official daily wins and ranks by score then completion time", async () => {
    const alex = await newSessionCookie();
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      cookies: cookies(alex),
      payload: { email: "alex-lb@example.com", password: "password123", displayName: "Alex" },
    });
    await app.inject({
      method: "POST",
      url: "/api/games/complete",
      cookies: cookies(alex),
      payload: {
        puzzleId: await todayPuzzleId(),
        attemptId: "lb-alex",
        status: "WON",
        guesses: ["ada", "lovelace"],
        startedAt: Date.now() - 8_000,
        completedAt: Date.now(),
      },
    });

    const lokesh = await newSessionCookie();
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      cookies: cookies(lokesh),
      payload: { email: "lokesh-lb@example.com", password: "password123", displayName: "Lokesh" },
    });
    await app.inject({
      method: "POST",
      url: "/api/games/complete",
      cookies: cookies(lokesh),
      payload: {
        puzzleId: await todayPuzzleId(),
        attemptId: "lb-lokesh",
        status: "WON",
        guesses: ["ada", "lovelace", "zzzz", "qqqq"],
        startedAt: Date.now() - 20_000,
        completedAt: Date.now(),
      },
    });

    const board = await app.inject({
      method: "GET",
      url: "/api/leaderboard/today?page=1&pageSize=20",
      cookies: cookies(alex),
    });
    expect(board.statusCode).toBe(200);
    const body = board.json();
    expect(body.authenticated).toBe(true);
    expect(body.played).toBe(true);
    expect(body.entries.map((entry: { displayName: string }) => entry.displayName)).toEqual([
      "Alex",
      "Lokesh",
    ]);
    expect(body.entries[0].rank).toBe(1);
    expect(body.entries[0].isCurrentUser).toBe(true);
    expect(body.me.rank).toBe(1);
    expect(body.entries[0]).not.toHaveProperty("email");
    expect(body.entries[0]).not.toHaveProperty("userId");
  });

  it("excludes archive official wins and give-ups from today's leaderboard", async () => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - 3);
    const dateOnly = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const source = await prisma.puzzle.findUniqueOrThrow({ where: { id: await todayPuzzleId() } });
    const archiveId = "puzzle-archive-lb-180";
    await prisma.puzzle.create({
      data: {
        id: archiveId,
        articleId: source.articleId,
        puzzleNumber: 180,
        scheduledDate: dateOnly,
        generatorVersion: source.generatorVersion,
        clientPuzzleData: { ...(source.clientPuzzleData as object), id: archiveId, puzzleNumber: 180 },
        status: "PUBLISHED",
        title: source.title,
        titleMatchKey: source.titleMatchKey,
        wordCount: source.wordCount,
        guessableWordCount: source.guessableWordCount,
        uniqueGuessableWordCount: source.uniqueGuessableWordCount,
        titleTokenCount: source.titleTokenCount,
        difficultyValue: source.difficultyValue,
        difficultyVersion: source.difficultyVersion,
        publishedAt: dateOnly,
      },
    });
    await prisma.dailyPuzzle.create({
      data: { date: dateOnly, puzzleId: archiveId, publishedAt: dateOnly },
    });

    const sessionId = await newSessionCookie();
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      cookies: cookies(sessionId),
      payload: { email: "archive-lb@example.com", password: "password123", displayName: "Archie" },
    });
    await app.inject({
      method: "POST",
      url: "/api/games/complete",
      cookies: cookies(sessionId),
      payload: {
        puzzleId: archiveId,
        attemptId: "lb-archive",
        status: "WON",
        guesses: ["ada", "lovelace"],
        startedAt: Date.now() - 5_000,
        completedAt: Date.now(),
      },
    });
    const board = await app.inject({
      method: "GET",
      url: "/api/leaderboard/today",
      cookies: cookies(sessionId),
    });
    expect(board.json().entries).toEqual([]);
    expect(board.json().played).toBe(false);

    await prisma.gameResult.deleteMany({ where: { puzzleId: archiveId } });
    await prisma.dailyPuzzle.delete({ where: { puzzleId: archiveId } });
    await prisma.puzzle.delete({ where: { id: archiveId } });
  });

  it("marks archive play state without exposing answers", async () => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - 4);
    const dateOnly = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const source = await prisma.puzzle.findUniqueOrThrow({ where: { id: await todayPuzzleId() } });
    const archiveId = "puzzle-archive-state-181";
    await prisma.puzzle.create({
      data: {
        id: archiveId,
        articleId: source.articleId,
        puzzleNumber: 181,
        scheduledDate: dateOnly,
        generatorVersion: source.generatorVersion,
        clientPuzzleData: { ...(source.clientPuzzleData as object), id: archiveId, puzzleNumber: 181 },
        status: "PUBLISHED",
        title: source.title,
        titleMatchKey: source.titleMatchKey,
        wordCount: source.wordCount,
        guessableWordCount: source.guessableWordCount,
        uniqueGuessableWordCount: source.uniqueGuessableWordCount,
        titleTokenCount: source.titleTokenCount,
        publishedAt: dateOnly,
      },
    });
    await prisma.dailyPuzzle.create({
      data: { date: dateOnly, puzzleId: archiveId, publishedAt: dateOnly },
    });

    const sessionId = await newSessionCookie();
    const before = await app.inject({
      method: "GET",
      url: "/api/puzzles/archive?page=1&pageSize=20",
      cookies: cookies(sessionId),
    });
    const unplayed = before.json().items.find((item: { puzzleId: string }) => item.puzzleId === archiveId);
    expect(unplayed.playState).toBe("UNPLAYED");

    await app.inject({
      method: "POST",
      url: "/api/games/complete",
      cookies: cookies(sessionId),
      payload: {
        puzzleId: archiveId,
        attemptId: "archive-state",
        status: "WON",
        guesses: ["ada", "lovelace"],
        startedAt: Date.now() - 5_000,
        completedAt: Date.now(),
      },
    });
    const after = await app.inject({
      method: "GET",
      url: "/api/puzzles/archive?page=1&pageSize=20",
      cookies: cookies(sessionId),
    });
    const played = after.json().items.find((item: { puzzleId: string }) => item.puzzleId === archiveId);
    expect(played.playState).toBe("COMPLETED");
    expect(JSON.stringify(after.json())).not.toContain("Ada Lovelace");

    await prisma.gameResult.deleteMany({ where: { puzzleId: archiveId } });
    await prisma.dailyPuzzle.delete({ where: { puzzleId: archiveId } });
    await prisma.puzzle.delete({ where: { id: archiveId } });
  });
});

describe("phase 7 production readiness", () => {
  it("exposes liveness and readiness with safe bodies", async () => {
    const live = await app.inject({
      method: "GET",
      url: "/health",
      headers: { "x-request-id": "health-req-1" },
    });
    expect(live.statusCode).toBe(200);
    expect(live.json()).toEqual({ status: "ok" });
    expect(live.headers["x-request-id"]).toBe("health-req-1");

    const ready = await app.inject({ method: "GET", url: "/health/ready" });
    expect(ready.statusCode).toBe(200);
    expect(ready.json().dependencies.postgres.status).toBe("ok");
    expect(ready.json().dependencies.redis.status).toBe("ok");
    expect(JSON.stringify(ready.json())).not.toMatch(/postgresql:\/\//);
  });

  it("attaches request IDs to error responses", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: { "x-request-id": "login-req-1" },
      payload: { email: "missing@example.com", password: "wrong-password" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.requestId).toBe("login-req-1");
    expect(res.headers["x-request-id"]).toBe("login-req-1");
  });

  it("reports Postgres outage as not ready and Redis outage as degraded", async () => {
    const down = await buildApp({
      config,
      wikipediaProvider: { fetchPage },
      googleOAuth,
      mailer,
      checkPostgres: async () => ({ status: "error", message: "postgresql://secret@localhost/db" }),
      checkRedis: async () => ({ status: "error", message: "redis://secret" }),
    });
    const ready = await down.inject({ method: "GET", url: "/health/ready" });
    expect(ready.statusCode).toBe(503);
    expect(JSON.stringify(ready.json())).not.toContain("secret");
    await down.close();

    const redisDown = await buildApp({
      config,
      wikipediaProvider: { fetchPage },
      googleOAuth,
      mailer,
      checkPostgres: async () => ({ status: "ok" }),
      checkRedis: async () => ({ status: "error", message: "timeout" }),
    });
    const degraded = await redisDown.inject({ method: "GET", url: "/health/ready" });
    expect(degraded.statusCode).toBe(200);
    expect(degraded.json().dependencies.redis.status).toBe("degraded");
    const live = await redisDown.inject({ method: "GET", url: "/health" });
    expect(live.statusCode).toBe(200);
    await redisDown.close();
  });

  it("allows only FRONTEND_ORIGIN in production CORS", async () => {
    const prod = await buildApp({
      config: {
        ...config,
        NODE_ENV: "production",
        FRONTEND_ORIGIN: "https://play.wikognito.test",
      },
      wikipediaProvider: { fetchPage },
      googleOAuth,
      mailer,
    });
    const allowed = await prod.inject({
      method: "GET",
      url: "/api/health",
      headers: { origin: "https://play.wikognito.test" },
    });
    expect(allowed.headers["access-control-allow-origin"]).toBe("https://play.wikognito.test");

    const denied = await prod.inject({
      method: "GET",
      url: "/api/health",
      headers: { origin: "https://evil.example" },
    });
    expect(denied.headers["access-control-allow-origin"]).toBeUndefined();
    await prod.close();
  });

  it("rate limits auth endpoints", async () => {
    const limited = await buildApp({
      config: {
        ...config,
        RATE_LIMIT_ENABLED: true,
        RATE_LIMIT_AUTH_MAX: 1,
      },
      wikipediaProvider: { fetchPage },
      googleOAuth,
      mailer,
    });
    const ip = `203.0.113.${1 + Math.floor(Math.random() * 250)}`;
    const first = await limited.inject({
      method: "POST",
      url: "/api/auth/login",
      remoteAddress: ip,
      payload: { email: "rate@example.com", password: "password123" },
    });
    const second = await limited.inject({
      method: "POST",
      url: "/api/auth/login",
      remoteAddress: ip,
      payload: { email: "rate@example.com", password: "password123" },
    });
    expect(first.statusCode).not.toBe(429);
    expect(second.statusCode).toBe(429);
    expect(second.json().error.code).toBe("RATE_LIMITED");
    expect(second.headers["retry-after"]).toBeTruthy();
    await limited.close();
  });

  it("publishes via PUBLISH_SECRET and rejects bad or missing secrets", async () => {
    const secretApp = await buildApp({
      config: { ...config, PUBLISH_SECRET: "publish-test-secret" },
      wikipediaProvider: { fetchPage },
      googleOAuth,
      mailer,
    });

    const missing = await app.inject({ method: "POST", url: "/api/internal/puzzles/publish-today" });
    expect(missing.statusCode).toBe(503);
    expect(missing.json().error.code).toBe("PUBLISH_UNAVAILABLE");

    const denied = await secretApp.inject({
      method: "POST",
      url: "/api/internal/puzzles/publish-today",
      headers: { authorization: "Bearer wrong-secret" },
    });
    expect(denied.statusCode).toBe(401);

    const first = await secretApp.inject({
      method: "POST",
      url: "/api/internal/puzzles/publish-today",
      headers: { authorization: "Bearer publish-test-secret" },
    });
    expect(["PUBLISHED", "ALREADY_PUBLISHED"]).toContain(first.json().status);
    const second = await secretApp.inject({
      method: "POST",
      url: "/api/internal/puzzles/publish-today",
      headers: { authorization: "Bearer publish-test-secret" },
    });
    expect(second.statusCode).toBe(200);
    expect(second.json().status).toBe("ALREADY_PUBLISHED");
    await secretApp.close();
  });

  it("keeps /api/puzzles/today from publishing", async () => {
    const before = await prisma.dailyPuzzle.count();
    const today = await app.inject({ method: "GET", url: "/api/puzzles/today" });
    expect(today.statusCode).toBe(200);
    expect(await prisma.dailyPuzzle.count()).toBe(before);
  });
});

