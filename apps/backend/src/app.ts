import { randomUUID } from "node:crypto";
import Fastify, { type FastifyInstance, type FastifyReply } from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import {
  AddDossierCaseRequestSchema,
  AdminArticlePlayParamSchema,
  AdminDossierCaseParamSchema,
  AdminDossierIdParamSchema,
  ArchivePuzzleParamSchema,
  ArticleListQuerySchema,
  ChangePasswordRequestSchema,
  CompleteGameRequestSchema,
  CorpusProcessRequestSchema,
  CreateDossierRequestSchema,
  DeleteAccountRequestSchema,
  DossierCaseParamSchema,
  DossierListQuerySchema,
  DossierSeedRequestSchema,
  DossierSlugParamSchema,
  EmailAuthRequestSchema,
  ForgotPasswordRequestSchema,
  GeneratePuzzleRequestSchema,
  ImportArticleRequestSchema,
  LeaderboardQuerySchema,
  ProfileUpdateRequestSchema,
  PuzzleListQuerySchema,
  ReorderDossierCaseRequestSchema,
  ResetPasswordRequestSchema,
  SessionSyncRequestSchema,
  UpdateDossierRequestSchema,
  VerifyEmailRequestSchema,
} from "@redactle/shared";
import type { WikipediaPageFetcher } from "@redactle/article-ingestion";
import { WikipediaArticleProvider } from "@redactle/article-provider";
import type { AppConfig } from "./infrastructure/config/env.js";
import { getPrisma, checkPostgresHealth } from "./infrastructure/postgres/prisma.js";
import { checkRedisHealth, getRedis, tryConnectRedis } from "./infrastructure/redis/redis-client.js";
import { readinessFromDependencies, toSafeDependency } from "./infrastructure/health.js";
import { logger } from "./infrastructure/logger.js";
import { PuzzleRepository } from "./modules/puzzles/puzzle.repository.js";
import { PuzzleService } from "./modules/puzzles/puzzle.service.js";
import { SessionRepository } from "./modules/sessions/session.repository.js";
import { SessionService } from "./modules/sessions/session.service.js";
import { GameRepository } from "./modules/games/game.repository.js";
import { GameService } from "./modules/games/game.service.js";
import { StatsRepository } from "./modules/stats/stats.repository.js";
import { StatsService } from "./modules/stats/stats.service.js";
import { ArticleRepository } from "./modules/articles/article.repository.js";
import { ArticleService } from "./modules/articles/article.service.js";
import { IdentitySessionRepository } from "./modules/identity/identity-session.repository.js";
import { AuthService } from "./modules/auth/auth.service.js";
import { requireAdmin, requireAuthenticatedUser } from "./modules/auth/authorization.js";
import {
  GoogleOAuthClient,
  UnconfiguredGoogleOAuth,
  type GoogleOAuthAdapter,
} from "./modules/auth/google-oauth.js";
import { createMailer, type Mailer } from "./modules/auth/mailer.js";
import { AppError, isAuthFailure, toErrorResponse } from "./modules/errors.js";
import { LeaderboardService } from "./modules/leaderboard/leaderboard.service.js";
import { rateLimitMax } from "./modules/security/rate-limit.js";
import { timingSafeEqualSecret } from "./modules/security/secrets.js";
import { DossierRepository } from "./modules/dossiers/dossier.repository.js";
import { DossierService } from "./modules/dossiers/dossier.service.js";

export interface AppDeps {
  config: AppConfig;
  wikipediaProvider?: WikipediaPageFetcher;
  googleOAuth?: GoogleOAuthAdapter;
  mailer?: Mailer;
  checkPostgres?: typeof checkPostgresHealth;
  checkRedis?: typeof checkRedisHealth;
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const { config } = deps;
  const probePostgres = deps.checkPostgres ?? checkPostgresHealth;
  const probeRedis = deps.checkRedis ?? checkRedisHealth;
  const app = Fastify({
    logger: false,
    // Render terminates TLS and forwards the visitor address. Trust that hop in production
    // so rate limits key on the client IP. Tests and local dev keep the direct socket address.
    trustProxy: config.NODE_ENV === "production",
    requestIdHeader: "x-request-id",
    genReqId: (request) => {
      const incoming = request.headers["x-request-id"];
      if (typeof incoming === "string" && incoming.length > 0 && incoming.length <= 128) {
        return incoming;
      }
      return randomUUID();
    },
  });

  if (config.NODE_ENV === "production") {
    await app.register(cors, {
      origin: (origin, callback) => {
        if (!origin || origin === config.FRONTEND_ORIGIN) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
      credentials: true,
    });
  } else {
    await app.register(cors, {
      origin: true,
      credentials: true,
    });
  }

  await app.register(helmet, {
    global: true,
    hsts: config.NODE_ENV === "production" ? { maxAge: 15552000, includeSubDomains: true } : false,
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    permittedCrossDomainPolicies: { permittedPolicies: "none" },
  });
  await app.register(cookie);
  app.addContentTypeParser("application/json", { parseAs: "string" }, (_request, body, done) => {
    const raw = typeof body === "string" ? body : body.toString();
    if (!raw || raw.length === 0) {
      done(null, {});
      return;
    }
    try {
      done(null, JSON.parse(raw) as unknown);
    } catch (error) {
      done(error as Error, undefined);
    }
  });

  const prisma = getPrisma();
  const redis = getRedis(config);
  await tryConnectRedis(config);

  if (config.RATE_LIMIT_ENABLED) {
    await app.register(rateLimit, {
      global: true,
      timeWindow: "1 minute",
      redis,
      skipOnError: true,
      allowList: (request) => rateLimitMax(request.url, config) === 0,
      max: (request) => rateLimitMax(request.url, config) || config.RATE_LIMIT_PUBLIC_MAX,
      keyGenerator: (request) => {
        const sessionId = request.cookies?.[config.SESSION_COOKIE_NAME];
        return sessionId ? `${rateLimitMax(request.url, config)}:${sessionId}` : request.ip;
      },
      errorResponseBuilder: (request, context) => ({
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests.",
          requestId: request.id,
        },
        statusCode: 429,
        ttl: context.ttl,
      }),
    });
  }

  const puzzleRepo = new PuzzleRepository(prisma, redis, 3600);
  const sessionRepo = new SessionRepository(redis, config.SESSION_TTL_SECONDS);
  const sessionService = new SessionService(sessionRepo, puzzleRepo);
  const identitySessions = new IdentitySessionRepository(prisma);
  const gameRepo = new GameRepository(prisma);
  const puzzleService = new PuzzleService(
    puzzleRepo,
    prisma,
    redis,
    config.PUZZLE_GENERATOR_VERSION,
    gameRepo,
  );
  const gameService = new GameService(gameRepo, puzzleRepo, sessionRepo);
  const statsRepo = new StatsRepository(prisma);
  const statsService = new StatsService(statsRepo);
  const leaderboardService = new LeaderboardService(prisma, puzzleRepo);
  const articleRepo = new ArticleRepository(prisma);
  const wikipediaProvider =
    deps.wikipediaProvider ??
    new WikipediaArticleProvider({
      apiUrl: config.WIKIPEDIA_API_URL,
      userAgent: config.WIKIPEDIA_USER_AGENT,
    });
  const articleService = new ArticleService(
    articleRepo,
    prisma,
    wikipediaProvider,
    config.PUZZLE_GENERATOR_VERSION,
  );
  const dossierService = new DossierService(
    new DossierRepository(prisma),
    puzzleRepo,
    gameRepo,
    prisma,
    wikipediaProvider,
    config.PUZZLE_GENERATOR_VERSION,
    config.WIKIPEDIA_IMPORT_CONCURRENCY,
    config.WIKIPEDIA_REQUEST_DELAY_MS,
  );
  const authService = new AuthService(
    prisma,
    identitySessions,
    sessionRepo,
    gameRepo,
    config.GOOGLE_ADMIN_EMAILS,
    deps.mailer ?? createMailer(config.SMTP_URL),
    config.FRONTEND_ORIGIN,
  );
  const googleOAuth: GoogleOAuthAdapter =
    deps.googleOAuth ??
    (config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET
      ? new GoogleOAuthClient(redis, {
          clientId: config.GOOGLE_CLIENT_ID,
          clientSecret: config.GOOGLE_CLIENT_SECRET,
          redirectUri: config.GOOGLE_REDIRECT_URI,
        })
      : new UnconfiguredGoogleOAuth());

  async function ensureSessionId(
    request: { cookies: Record<string, string | undefined> },
    reply: {
      setCookie: (name: string, value: string, opts: Record<string, unknown>) => void;
    },
  ): Promise<string> {
    let sessionId = request.cookies[config.SESSION_COOKIE_NAME];
    if (!sessionId) {
      sessionId = sessionService.createSessionId();
      reply.setCookie(config.SESSION_COOKIE_NAME, sessionId, {
        path: "/",
        httpOnly: true,
        sameSite: config.NODE_ENV === "production" ? "none" : "lax",
        secure: config.NODE_ENV === "production",
        maxAge: config.SESSION_TTL_SECONDS,
      });
    }
    await identitySessions.upsert(sessionId, config.SESSION_TTL_SECONDS);
    return sessionId;
  }

  function mapError(error: unknown, reply: FastifyReply) {
    const mapped = toErrorResponse(error, config.NODE_ENV === "development", reply.request.id);
    if (mapped.statusCode >= 500) {
      logger.error("request_error", {
        requestId: reply.request.id,
        route: reply.request.routeOptions.url ?? reply.request.url,
        method: reply.request.method,
        status: mapped.statusCode,
        errorCode: mapped.body.error.code,
        message: error instanceof Error ? error.message : "unknown",
      });
    } else if (isAuthFailure(error, mapped.statusCode)) {
      logger.warn("auth_failure", {
        requestId: reply.request.id,
        route: reply.request.routeOptions.url ?? reply.request.url,
        errorCode: mapped.body.error.code,
        status: mapped.statusCode,
      });
    }
    return reply.status(mapped.statusCode).header("X-Request-Id", reply.request.id).send(mapped.body);
  }

  app.setErrorHandler((error, _request, reply) => {
    return mapError(error, reply);
  });

  app.addHook("onRequest", async (request, reply) => {
    reply.header("X-Request-Id", request.id);
    reply.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  });

  app.addHook("onResponse", async (request, reply) => {
    const payload = {
      requestId: request.id,
      route: request.routeOptions.url ?? request.url,
      method: request.method,
      status: reply.statusCode,
      duration: Math.round(reply.elapsedTime),
    };
    if (reply.statusCode >= 500) {
      logger.error("request", payload);
      return;
    }
    logger.info("request", payload);
  });

  const liveness = async () => ({ status: "ok" as const });
  app.get("/health", liveness);
  app.get("/api/health", liveness);

  async function readiness(_request: unknown, reply: FastifyReply) {
    const postgres = toSafeDependency(await probePostgres());
    const redisHealth = toSafeDependency(await probeRedis(config));
    const result = readinessFromDependencies(postgres, redisHealth);
    return reply.status(result.statusCode).send(result.body);
  }
  app.get("/health/ready", readiness);
  app.get("/api/health/dependencies", readiness);

  app.get("/api/puzzles/today", async (request, reply) => {
    try {
      await ensureSessionId(request, reply);
      return await puzzleService.getToday();
    } catch (error) {
      logger.error("puzzle_fetch_failed", {
        requestId: request.id,
        route: "/api/puzzles/today",
        errorCode: error instanceof AppError ? error.code : "INTERNAL_ERROR",
      });
      return mapError(error, reply);
    }
  });

  app.get("/api/puzzles/archive", async (request, reply) => {
    try {
      const sessionId = await ensureSessionId(request, reply);
      const parsed = PuzzleListQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: "INVALID_REQUEST", message: "Invalid archive query." },
        });
      }
      const identity = await identitySessions.findWithUser(sessionId);
      return await puzzleService.listArchive(parsed.data.page, parsed.data.pageSize, {
        sessionId,
        userId: identity?.userId ?? null,
      });
    } catch (error) {
      return mapError(error, reply);
    }
  });

  app.get("/api/leaderboard/today", async (request, reply) => {
    try {
      const sessionId = await ensureSessionId(request, reply);
      const parsed = LeaderboardQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: "INVALID_REQUEST", message: "Invalid leaderboard query." },
        });
      }
      const identity = await identitySessions.findWithUser(sessionId);
      return await leaderboardService.today(
        parsed.data.page,
        parsed.data.pageSize,
        identity?.userId ?? null,
      );
    } catch (error) {
      return mapError(error, reply);
    }
  });

  app.get("/api/dossiers", async (request, reply) => {
    try {
      await ensureSessionId(request, reply);
      const parsed = DossierListQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: "INVALID_REQUEST", message: "Invalid dossier list query." },
        });
      }
      return await dossierService.listPublished(parsed.data.page, parsed.data.pageSize, parsed.data.q);
    } catch (error) {
      return mapError(error, reply);
    }
  });

  app.get("/api/dossiers/:slug", async (request, reply) => {
    try {
      const sessionId = await ensureSessionId(request, reply);
      const parsed = DossierSlugParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: "INVALID_REQUEST", message: "Invalid dossier slug." },
        });
      }
      const identity = await identitySessions.findWithUser(sessionId);
      return await dossierService.getPublished(parsed.data.slug, {
        sessionId,
        userId: identity?.userId ?? null,
      });
    } catch (error) {
      return mapError(error, reply);
    }
  });

  app.get("/api/dossiers/:slug/cases/:caseId", async (request, reply) => {
    try {
      const sessionId = await ensureSessionId(request, reply);
      const parsed = DossierCaseParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: "INVALID_REQUEST", message: "Invalid dossier case." },
        });
      }
      const identity = await identitySessions.findWithUser(sessionId);
      return await dossierService.getPublishedCase(parsed.data.slug, parsed.data.caseId, {
        sessionId,
        userId: identity?.userId ?? null,
      });
    } catch (error) {
      return mapError(error, reply);
    }
  });

  app.get("/api/puzzles/archive/:id", async (request, reply) => {
    try {
      const sessionId = await ensureSessionId(request, reply);
      const parsed = ArchivePuzzleParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: "INVALID_REQUEST", message: "Invalid archive puzzle id." },
        });
      }
      const puzzle = await puzzleService.getArchivePuzzle(parsed.data.id);
      const identity = await identitySessions.findWithUser(sessionId);
      const officialResult = await gameService.getOfficialSummary(
        sessionId,
        identity?.userId ?? null,
        parsed.data.id,
      );
      return { ...puzzle, officialResult };
    } catch (error) {
      return mapError(error, reply);
    }
  });

  app.get("/api/sessions/current", async (request, reply) => {
    try {
      const sessionId = await ensureSessionId(request, reply);
      const state = await sessionService.getCurrent(sessionId);
      if (!state) {
        return reply.status(204).send();
      }
      return state;
    } catch (error) {
      return mapError(error, reply);
    }
  });

  app.post("/api/sessions/sync", async (request, reply) => {
    try {
      const sessionId = await ensureSessionId(request, reply);
      const parsed = SessionSyncRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: "INVALID_REQUEST", message: "Invalid session sync payload." },
        });
      }
      const state = await sessionService.sync(sessionId, parsed.data);
      return state;
    } catch (error) {
      return mapError(error, reply);
    }
  });

  app.post("/api/games/complete", async (request, reply) => {
    try {
      const sessionId = await ensureSessionId(request, reply);
      const parsed = CompleteGameRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: "INVALID_REQUEST", message: "Invalid game completion payload." },
        });
      }
      const identity = await identitySessions.findWithUser(sessionId);
      const result = await gameService.complete(sessionId, identity?.userId ?? null, parsed.data);
      logger.info(result.won ? "game_completed" : "game_give_up", {
        requestId: request.id,
        puzzleId: result.puzzleId,
        won: result.won,
        guessCount: result.guessCount,
      });
      return result;
    } catch (error) {
      return mapError(error, reply);
    }
  });

  app.get("/api/puzzles/:id/stats", async (request, reply) => {
    try {
      await ensureSessionId(request, reply);
      const parsed = ArchivePuzzleParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: "INVALID_REQUEST", message: "Invalid puzzle id." },
        });
      }
      return await gameService.getPuzzleStats(parsed.data.id);
    } catch (error) {
      return mapError(error, reply);
    }
  });

  app.get("/api/stats", async (request, reply) => {
    try {
      const sessionId = await ensureSessionId(request, reply);
      return await statsService.getForSession(sessionId);
    } catch (error) {
      return mapError(error, reply);
    }
  });

  app.get("/api/auth/google", async (request, reply) => {
    try {
      const sessionId = await ensureSessionId(request, reply);
      const url = await googleOAuth.createAuthorizationUrl(sessionId);
      return reply.redirect(url);
    } catch (error) {
      return mapError(error, reply);
    }
  });

  app.get("/api/auth/google/callback", async (request, reply) => {
    try {
      const sessionId = await ensureSessionId(request, reply);
      const query = request.query as { code?: string; state?: string; error?: string };
      if (query.error) {
        throw new AppError("OAUTH_DENIED", "Google sign-in was cancelled or denied.", 400);
      }
      if (!query.code || !query.state) {
        throw new AppError("INVALID_OAUTH_CALLBACK", "Invalid OAuth callback.", 400);
      }
      const profile = await googleOAuth.exchangeCallback({
        code: query.code,
        state: query.state,
        sessionId,
      });
      await authService.authenticateGoogleProfile(sessionId, profile);
      return reply.redirect(`${config.FRONTEND_ORIGIN.replace(/\/$/, "")}/`);
    } catch (error) {
      return mapError(error, reply);
    }
  });

  app.post("/api/auth/register", async (request, reply) => {
    try {
      const sessionId = await ensureSessionId(request, reply);
      const parsed = EmailAuthRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: "INVALID_REQUEST", message: "Invalid email or password." },
        });
      }
      const user = await authService.registerWithEmail(sessionId, parsed.data);
      return user;
    } catch (error) {
      return mapError(error, reply);
    }
  });

  app.post("/api/auth/login", async (request, reply) => {
    try {
      const sessionId = await ensureSessionId(request, reply);
      const parsed = EmailAuthRequestSchema.pick({ email: true, password: true }).safeParse(
        request.body,
      );
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: "INVALID_REQUEST", message: "Invalid email or password." },
        });
      }
      const user = await authService.loginWithEmail(sessionId, parsed.data);
      return user;
    } catch (error) {
      return mapError(error, reply);
    }
  });

  app.post("/api/auth/logout", async (request, reply) => {
    try {
      const sessionId = await ensureSessionId(request, reply);
      await authService.logout(sessionId);
      return { ok: true as const };
    } catch (error) {
      return mapError(error, reply);
    }
  });

  app.get("/api/me", async (request, reply) => {
    try {
      const sessionId = await ensureSessionId(request, reply);
      const identity = await identitySessions.findWithUser(sessionId);
      const user = requireAuthenticatedUser(identity);
      return await authService.getMe(user.id);
    } catch (error) {
      return mapError(error, reply);
    }
  });

  app.get("/api/me/stats", async (request, reply) => {
    try {
      const sessionId = await ensureSessionId(request, reply);
      const identity = await identitySessions.findWithUser(sessionId);
      const user = requireAuthenticatedUser(identity);
      return await statsService.getForUser(user.id);
    } catch (error) {
      return mapError(error, reply);
    }
  });

  app.get("/api/me/history", async (request, reply) => {
    try {
      const sessionId = await ensureSessionId(request, reply);
      const identity = await identitySessions.findWithUser(sessionId);
      const user = requireAuthenticatedUser(identity);
      const parsed = PuzzleListQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: "INVALID_REQUEST", message: "Invalid history query." },
        });
      }
      return await gameService.getHistory(user.id, parsed.data.page, parsed.data.pageSize);
    } catch (error) {
      return mapError(error, reply);
    }
  });

  app.patch("/api/me/profile", async (request, reply) => {
    try {
      const sessionId = await ensureSessionId(request, reply);
      const identity = await identitySessions.findWithUser(sessionId);
      const user = requireAuthenticatedUser(identity);
      const parsed = ProfileUpdateRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: "INVALID_REQUEST", message: "Invalid profile update." },
        });
      }
      return await authService.updateProfile(user.id, parsed.data.displayName);
    } catch (error) {
      return mapError(error, reply);
    }
  });

  app.post("/api/auth/email/verify", async (request, reply) => {
    try {
      const parsed = VerifyEmailRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: "INVALID_REQUEST", message: "Invalid verification token." },
        });
      }
      return await authService.verifyEmail(parsed.data.token);
    } catch (error) {
      return mapError(error, reply);
    }
  });

  app.post("/api/auth/email/resend", async (request, reply) => {
    try {
      const sessionId = await ensureSessionId(request, reply);
      const identity = await identitySessions.findWithUser(sessionId);
      const user = requireAuthenticatedUser(identity);
      return await authService.resendVerification(user.id);
    } catch (error) {
      return mapError(error, reply);
    }
  });

  app.post("/api/auth/password/forgot", async (request, reply) => {
    try {
      const parsed = ForgotPasswordRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: "INVALID_REQUEST", message: "Invalid email." },
        });
      }
      return await authService.forgotPassword(parsed.data.email);
    } catch (error) {
      return mapError(error, reply);
    }
  });

  app.post("/api/auth/password/reset", async (request, reply) => {
    try {
      const parsed = ResetPasswordRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: "INVALID_REQUEST", message: "Invalid password reset request." },
        });
      }
      return await authService.resetPassword(parsed.data.token, parsed.data.password);
    } catch (error) {
      return mapError(error, reply);
    }
  });

  app.post("/api/me/password/change", async (request, reply) => {
    try {
      const sessionId = await ensureSessionId(request, reply);
      const identity = await identitySessions.findWithUser(sessionId);
      const user = requireAuthenticatedUser(identity);
      const parsed = ChangePasswordRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: "INVALID_REQUEST", message: "Invalid password change request." },
        });
      }
      return await authService.changePassword(
        user.id,
        parsed.data.currentPassword,
        parsed.data.newPassword,
      );
    } catch (error) {
      return mapError(error, reply);
    }
  });

  app.delete("/api/me", async (request, reply) => {
    try {
      const sessionId = await ensureSessionId(request, reply);
      const identity = await identitySessions.findWithUser(sessionId);
      const user = requireAuthenticatedUser(identity);
      const parsed = DeleteAccountRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: "INVALID_REQUEST", message: "Account deletion must be confirmed." },
        });
      }
      return await authService.deleteAccount(user.id, parsed.data.password);
    } catch (error) {
      return mapError(error, reply);
    }
  });

  app.post("/api/admin/articles/import", async (request, reply) => {
    try {
      const sessionId = await ensureSessionId(request, reply);
      requireAdmin(await identitySessions.findWithUser(sessionId));
      const parsed = ImportArticleRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: "INVALID_REQUEST", message: "Invalid article import payload." },
        });
      }
      return await articleService.importFromUrl(parsed.data.url);
    } catch (error) {
      return mapError(error, reply);
    }
  });

  app.get("/api/admin/articles", async (request, reply) => {
    try {
      const sessionId = await ensureSessionId(request, reply);
      requireAdmin(await identitySessions.findWithUser(sessionId));
      const parsed = ArticleListQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: "INVALID_REQUEST", message: "Invalid article list query." },
        });
      }
      return await articleService.list(parsed.data.page, parsed.data.pageSize, parsed.data.q);
    } catch (error) {
      return mapError(error, reply);
    }
  });

  app.get("/api/admin/articles/:articleId/puzzle", async (request, reply) => {
    try {
      const sessionId = await ensureSessionId(request, reply);
      requireAdmin(await identitySessions.findWithUser(sessionId));
      const parsed = AdminArticlePlayParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: "INVALID_REQUEST", message: "Invalid article id." },
        });
      }
      return await articleService.getPlayPuzzle(parsed.data.articleId);
    } catch (error) {
      return mapError(error, reply);
    }
  });

  app.get("/api/admin/puzzles", async (request, reply) => {
    try {
      const sessionId = await ensureSessionId(request, reply);
      requireAdmin(await identitySessions.findWithUser(sessionId));
      const parsed = PuzzleListQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: "INVALID_REQUEST", message: "Invalid puzzle list query." },
        });
      }
      return await puzzleService.list(parsed.data.page, parsed.data.pageSize, parsed.data.q);
    } catch (error) {
      return mapError(error, reply);
    }
  });

  app.post("/api/admin/puzzles/generate", async (request, reply) => {
    try {
      const sessionId = await ensureSessionId(request, reply);
      requireAdmin(await identitySessions.findWithUser(sessionId));
      const parsed = GeneratePuzzleRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: "INVALID_REQUEST", message: "Invalid puzzle generate payload." },
        });
      }
      return await puzzleService.generate(parsed.data.articleId, parsed.data.force);
    } catch (error) {
      return mapError(error, reply);
    }
  });

  app.post("/api/admin/puzzles/validate", async (request, reply) => {
    try {
      const sessionId = await ensureSessionId(request, reply);
      requireAdmin(await identitySessions.findWithUser(sessionId));
      return await puzzleService.validateAll();
    } catch (error) {
      return mapError(error, reply);
    }
  });

  app.post("/api/admin/puzzles/publish-today", async (request, reply) => {
    try {
      const sessionId = await ensureSessionId(request, reply);
      requireAdmin(await identitySessions.findWithUser(sessionId));
      const published = await puzzleService.publishToday();
      const event =
        published.status === "PUBLISHED"
          ? "daily_publish_success"
          : published.status === "ALREADY_PUBLISHED"
            ? "daily_publish_already_published"
            : "daily_publish_no_candidate";
      logger.info(event, {
        requestId: request.id,
        status: published.status,
        puzzleId: published.puzzleId,
        date: published.date,
      });
      return published;
    } catch (error) {
      logger.error("daily_publish_failed", {
        requestId: request.id,
        errorCode: error instanceof AppError ? error.code : "PUBLISH_FAILED",
      });
      return mapError(error, reply);
    }
  });

  app.get("/api/admin/puzzles/pool-stats", async (request, reply) => {
    try {
      const sessionId = await ensureSessionId(request, reply);
      requireAdmin(await identitySessions.findWithUser(sessionId));
      return await puzzleService.poolStats(config.DAILY_POOL_WARNING_THRESHOLD);
    } catch (error) {
      return mapError(error, reply);
    }
  });

  app.post("/api/admin/corpus", async (request, reply) => {
    try {
      const sessionId = await ensureSessionId(request, reply);
      requireAdmin(await identitySessions.findWithUser(sessionId));
      const parsed = CorpusProcessRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: "INVALID_REQUEST", message: "Invalid corpus payload." },
        });
      }
      logger.info("corpus_import_started", {
        requestId: request.id,
        total: parsed.data.urls.length,
      });
      const result = await dossierService.processCorpus(parsed.data.urls);
      for (const item of result.items) {
        if (item.articleStatus === "imported") {
          logger.info("corpus_article_imported", { requestId: request.id, url: item.url });
        } else if (item.articleStatus === "failed") {
          logger.warn("corpus_article_failed", {
            requestId: request.id,
            url: item.url,
            stage: item.stage,
          });
        }
        if (item.puzzleStatus === "generated") {
          logger.info("corpus_puzzle_generated", { requestId: request.id, puzzleId: item.puzzleId });
        } else if (item.puzzleStatus === "failed") {
          logger.warn("corpus_puzzle_failed", {
            requestId: request.id,
            url: item.url,
            stage: item.stage,
          });
        }
      }
      return result;
    } catch (error) {
      return mapError(error, reply);
    }
  });

  app.get("/api/admin/dossiers", async (request, reply) => {
    try {
      const sessionId = await ensureSessionId(request, reply);
      requireAdmin(await identitySessions.findWithUser(sessionId));
      const parsed = DossierListQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: "INVALID_REQUEST", message: "Invalid dossier list query." },
        });
      }
      return await dossierService.listAdmin(parsed.data.page, parsed.data.pageSize, parsed.data.q);
    } catch (error) {
      return mapError(error, reply);
    }
  });

  app.post("/api/admin/dossiers/seed", async (request, reply) => {
    try {
      const sessionId = await ensureSessionId(request, reply);
      requireAdmin(await identitySessions.findWithUser(sessionId));
      const parsed = DossierSeedRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: "INVALID_REQUEST", message: "Invalid dossier seed payload." },
        });
      }
      const result = await dossierService.seed(parsed.data);
      logger.info("dossier_created", {
        requestId: request.id,
        slug: result.slug,
        created: result.created,
      });
      return result;
    } catch (error) {
      return mapError(error, reply);
    }
  });

  app.post("/api/admin/dossiers", async (request, reply) => {
    try {
      const sessionId = await ensureSessionId(request, reply);
      requireAdmin(await identitySessions.findWithUser(sessionId));
      const parsed = CreateDossierRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: "INVALID_REQUEST", message: "Invalid dossier payload." },
        });
      }
      const created = await dossierService.create(parsed.data);
      logger.info("dossier_created", { requestId: request.id, dossierId: created.id });
      return created;
    } catch (error) {
      return mapError(error, reply);
    }
  });

  app.get("/api/admin/dossiers/:id", async (request, reply) => {
    try {
      const sessionId = await ensureSessionId(request, reply);
      requireAdmin(await identitySessions.findWithUser(sessionId));
      const parsed = AdminDossierIdParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: "INVALID_REQUEST", message: "Invalid dossier id." },
        });
      }
      return await dossierService.getAdmin(parsed.data.id);
    } catch (error) {
      return mapError(error, reply);
    }
  });

  app.patch("/api/admin/dossiers/:id", async (request, reply) => {
    try {
      const sessionId = await ensureSessionId(request, reply);
      requireAdmin(await identitySessions.findWithUser(sessionId));
      const params = AdminDossierIdParamSchema.safeParse(request.params);
      const body = UpdateDossierRequestSchema.safeParse(request.body);
      if (!params.success || !body.success) {
        return reply.status(400).send({
          error: { code: "INVALID_REQUEST", message: "Invalid dossier update." },
        });
      }
      const updated = await dossierService.update(params.data.id, body.data);
      if (body.data.status === "PUBLISHED") {
        logger.info("dossier_published", { requestId: request.id, dossierId: updated.id });
      }
      return updated;
    } catch (error) {
      return mapError(error, reply);
    }
  });

  app.post("/api/admin/dossiers/:id/cases", async (request, reply) => {
    try {
      const sessionId = await ensureSessionId(request, reply);
      requireAdmin(await identitySessions.findWithUser(sessionId));
      const params = AdminDossierIdParamSchema.safeParse(request.params);
      const body = AddDossierCaseRequestSchema.safeParse(request.body);
      if (!params.success || !body.success) {
        return reply.status(400).send({
          error: { code: "INVALID_REQUEST", message: "Invalid dossier case payload." },
        });
      }
      const updated = await dossierService.addCase(params.data.id, body.data);
      logger.info("dossier_case_added", { requestId: request.id, dossierId: updated.id });
      return updated;
    } catch (error) {
      return mapError(error, reply);
    }
  });

  app.delete("/api/admin/dossiers/:id/cases/:caseId", async (request, reply) => {
    try {
      const sessionId = await ensureSessionId(request, reply);
      requireAdmin(await identitySessions.findWithUser(sessionId));
      const parsed = AdminDossierCaseParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: "INVALID_REQUEST", message: "Invalid dossier case." },
        });
      }
      return await dossierService.removeCase(parsed.data.id, parsed.data.caseId);
    } catch (error) {
      return mapError(error, reply);
    }
  });

  app.patch("/api/admin/dossiers/:id/cases/:caseId", async (request, reply) => {
    try {
      const sessionId = await ensureSessionId(request, reply);
      requireAdmin(await identitySessions.findWithUser(sessionId));
      const params = AdminDossierCaseParamSchema.safeParse(request.params);
      const body = ReorderDossierCaseRequestSchema.safeParse(request.body);
      if (!params.success || !body.success) {
        return reply.status(400).send({
          error: { code: "INVALID_REQUEST", message: "Invalid dossier case reorder." },
        });
      }
      return await dossierService.reorderCase(params.data.id, params.data.caseId, body.data.position);
    } catch (error) {
      return mapError(error, reply);
    }
  });

  app.post("/api/internal/puzzles/publish-today", async (request, reply) => {
    if (!config.PUBLISH_SECRET) {
      logger.warn("publish_unavailable", { requestId: request.id });
      return reply.status(503).send({
        error: {
          code: "PUBLISH_UNAVAILABLE",
          message: "Publish secret is not configured.",
          requestId: request.id,
        },
      });
    }
    const header = request.headers.authorization;
    const token = typeof header === "string" && header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!timingSafeEqualSecret(token, config.PUBLISH_SECRET)) {
      logger.warn("auth_failure", {
        requestId: request.id,
        route: "/api/internal/puzzles/publish-today",
        errorCode: "UNAUTHORIZED",
        status: 401,
      });
      return reply.status(401).send({
        error: { code: "UNAUTHORIZED", message: "Invalid publish secret.", requestId: request.id },
      });
    }
    try {
      const published = await puzzleService.publishToday();
      const event =
        published.status === "PUBLISHED"
          ? "daily_publish_success"
          : published.status === "ALREADY_PUBLISHED"
            ? "daily_publish_already_published"
            : "daily_publish_no_candidate";
      logger.info(event, {
        requestId: request.id,
        status: published.status,
        puzzleId: published.puzzleId,
        date: published.date,
      });
      return published;
    } catch (error) {
      logger.error("daily_publish_failed", {
        requestId: request.id,
        errorCode: error instanceof AppError ? error.code : "PUBLISH_FAILED",
      });
      return mapError(error, reply);
    }
  });

  return app;
}
