import { z } from "zod";
import { GameStatusSchema } from "./game.js";
import { PublicPuzzleDtoSchema } from "./tokens.js";

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

export const HealthResponseSchema = z.object({
  status: z.literal("ok"),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const DependencyHealthSchema = z.object({
  status: z.enum(["ok", "degraded", "error"]),
  dependencies: z.object({
    postgres: z.object({
      status: z.enum(["ok", "error"]),
      message: z.string().optional(),
    }),
    redis: z.object({
      status: z.enum(["ok", "error"]),
      message: z.string().optional(),
    }),
  }),
});
export type DependencyHealth = z.infer<typeof DependencyHealthSchema>;

export const CompleteGameRequestSchema = z.object({
  puzzleId: z.string(),
  attemptId: z.string(),
  status: z.enum(["WON", "GAVE_UP"]),
  guesses: z.array(z.string()),
  startedAt: z.number(),
  completedAt: z.number(),
});
export type CompleteGameRequest = z.infer<typeof CompleteGameRequestSchema>;

export const GameResultSourceSchema = z.enum(["DAILY", "ARCHIVE"]);
export type GameResultSource = z.infer<typeof GameResultSourceSchema>;

export const PuzzleStatsSchema = z.object({
  puzzleId: z.string(),
  gamesPlayed: z.number().int(),
  gamesWon: z.number().int(),
  gamesGaveUp: z.number().int(),
  medianGuessCount: z.number().nullable(),
  medianAccuracy: z.number().nullable(),
  medianDurationMs: z.number().int().nullable(),
  guessHistogram: z.record(z.string(), z.number().int()),
});
export type PuzzleStats = z.infer<typeof PuzzleStatsSchema>;

export function emptyPuzzleStats(puzzleId: string): PuzzleStats {
  return {
    puzzleId,
    gamesPlayed: 0,
    gamesWon: 0,
    gamesGaveUp: 0,
    medianGuessCount: null,
    medianAccuracy: null,
    medianDurationMs: null,
    guessHistogram: {},
  };
}

export const GameResultResponseSchema = z.object({
  id: z.string(),
  puzzleId: z.string(),
  attemptId: z.string(),
  attemptNumber: z.number().int(),
  isOfficial: z.boolean(),
  source: GameResultSourceSchema,
  startedAt: z.string(),
  completedAt: z.string(),
  durationMs: z.number().int(),
  guessCount: z.number().int(),
  hitGuessCount: z.number().int().nullable(),
  guessAccuracy: z.number().nullable(),
  won: z.boolean(),
  score: z.number().int(),
  scoreVersion: z.number().int(),
  status: GameStatusSchema,
  puzzleStats: PuzzleStatsSchema,
});
export type GameResultResponse = z.infer<typeof GameResultResponseSchema>;

export const StatsResponseSchema = z.object({
  gamesPlayed: z.number().int(),
  gamesWon: z.number().int(),
  gamesGaveUp: z.number().int(),
  averageGuesses: z.number().nullable(),
  bestGuessCount: z.number().int().nullable(),
});
export type StatsResponse = z.infer<typeof StatsResponseSchema>;

export const UserRoleSchema = z.enum(["USER", "ADMIN"]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const AuthProviderSchema = z.enum(["GOOGLE", "EMAIL"]);
export type AuthProvider = z.infer<typeof AuthProviderSchema>;

export const MeResponseSchema = z.object({
  id: z.string(),
  displayName: z.string().nullable(),
  email: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  role: UserRoleSchema,
  emailVerified: z.boolean(),
  hasPassword: z.boolean(),
  providers: z.array(AuthProviderSchema),
});
export type MeResponse = z.infer<typeof MeResponseSchema>;

export const ActivityDaySchema = z.object({
  date: z.string(),
  puzzleNumber: z.number().int(),
  status: z.enum(["WON", "GAVE_UP"]),
  guessCount: z.number().int(),
  durationMs: z.number().int(),
});
export type ActivityDay = z.infer<typeof ActivityDaySchema>;

export const TrendPointSchema = z.object({
  weekStart: z.string(),
  gamesPlayed: z.number().int(),
  gamesWon: z.number().int(),
  winRate: z.number(),
  averageGuesses: z.number().nullable(),
  averageCompletionTimeMs: z.number().int().nullable(),
});
export type TrendPoint = z.infer<typeof TrendPointSchema>;

export const UserStatsResponseSchema = z.object({
  gamesPlayed: z.number().int(),
  gamesWon: z.number().int(),
  gamesGaveUp: z.number().int(),
  winRate: z.number(),
  currentStreak: z.number().int(),
  longestStreak: z.number().int(),
  averageGuesses: z.number().nullable(),
  averageCompletionTimeMs: z.number().int().nullable(),
  guessAccuracy: z.number().nullable(),
  calendarStart: z.string(),
  activity: z.array(ActivityDaySchema),
  trends: z.array(TrendPointSchema),
});
export type UserStatsResponse = z.infer<typeof UserStatsResponseSchema>;

export const EmailAuthRequestSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(8).max(128),
  displayName: z.string().trim().min(1).max(80).optional(),
});
export type EmailAuthRequest = z.infer<typeof EmailAuthRequestSchema>;

export const ImportArticleRequestSchema = z.object({
  url: z.string().min(1),
});
export type ImportArticleRequest = z.infer<typeof ImportArticleRequestSchema>;

export const ArticleSummarySchema = z.object({
  id: z.string(),
  externalId: z.string(),
  title: z.string(),
  source: z.string(),
  sourceUrl: z.string().nullable(),
  revisionId: z.string().nullable(),
  language: z.string(),
  wordCount: z.number().int(),
  createdAt: z.string(),
});
export type ArticleSummary = z.infer<typeof ArticleSummarySchema>;

export const ImportArticleStatusSchema = z.enum(["IMPORTED", "ALREADY_EXISTS"]);
export type ImportArticleStatus = z.infer<typeof ImportArticleStatusSchema>;

export const ImportArticleResponseSchema = z.object({
  status: ImportArticleStatusSchema,
  article: ArticleSummarySchema,
});
export type ImportArticleResponse = z.infer<typeof ImportArticleResponseSchema>;

export const ArticleListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export type ArticleListQuery = z.infer<typeof ArticleListQuerySchema>;

export const AdminArticlePlayParamSchema = z.object({
  articleId: z.string().min(1),
});
export type AdminArticlePlayParam = z.infer<typeof AdminArticlePlayParamSchema>;

export const ArticleListResponseSchema = z.object({
  items: z.array(ArticleSummarySchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});
export type ArticleListResponse = z.infer<typeof ArticleListResponseSchema>;

export const PuzzleSummarySchema = z.object({
  id: z.string(),
  articleId: z.string(),
  title: z.string(),
  status: z.enum(["DRAFT", "READY", "PUBLISHED", "ARCHIVED"]),
  generatorVersion: z.string(),
  puzzleNumber: z.number().int(),
  scheduledDate: z.string().nullable(),
  wordCount: z.number().int(),
  guessableWordCount: z.number().int(),
  uniqueGuessableWordCount: z.number().int(),
  titleTokenCount: z.number().int(),
  createdAt: z.string(),
  publishedAt: z.string().nullable(),
});
export type PuzzleSummary = z.infer<typeof PuzzleSummarySchema>;

export const PuzzleListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export type PuzzleListQuery = z.infer<typeof PuzzleListQuerySchema>;

export const PuzzleListResponseSchema = z.object({
  items: z.array(PuzzleSummarySchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});
export type PuzzleListResponse = z.infer<typeof PuzzleListResponseSchema>;

export const GeneratePuzzleRequestSchema = z.object({
  articleId: z.string().min(1),
  force: z.boolean().optional().default(false),
});
export type GeneratePuzzleRequest = z.infer<typeof GeneratePuzzleRequestSchema>;

export const GeneratePuzzleResponseSchema = z.object({
  status: z.enum(["GENERATED", "ALREADY_EXISTS", "REJECTED", "FAILED"]),
  articleId: z.string(),
  articleTitle: z.string(),
  puzzleId: z.string().optional(),
  reason: z.string().optional(),
});
export type GeneratePuzzleResponse = z.infer<typeof GeneratePuzzleResponseSchema>;

export const ValidatePuzzlesResponseSchema = z.object({
  items: z.array(
    z.object({
      puzzleId: z.string(),
      articleId: z.string(),
      title: z.string(),
      status: z.string(),
      ok: z.boolean(),
      reason: z.string().optional(),
    }),
  ),
  failed: z.number().int(),
});
export type ValidatePuzzlesResponse = z.infer<typeof ValidatePuzzlesResponseSchema>;

export const PublishTodayResponseSchema = z.object({
  status: z.enum(["PUBLISHED", "ALREADY_PUBLISHED"]),
  date: z.string(),
  puzzleId: z.string(),
  puzzleNumber: z.number().int(),
  title: z.string(),
});
export type PublishTodayResponse = z.infer<typeof PublishTodayResponseSchema>;

export const ArchivePlayStateSchema = z.enum(["UNPLAYED", "COMPLETED"]);
export type ArchivePlayState = z.infer<typeof ArchivePlayStateSchema>;

export const ArchiveListItemSchema = z.object({
  puzzleId: z.string(),
  puzzleNumber: z.number().int(),
  date: z.string(),
  playState: ArchivePlayStateSchema,
});
export type ArchiveListItem = z.infer<typeof ArchiveListItemSchema>;

export const ArchiveListResponseSchema = z.object({
  items: z.array(ArchiveListItemSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});
export type ArchiveListResponse = z.infer<typeof ArchiveListResponseSchema>;

export const OfficialResultSummarySchema = z.object({
  status: z.enum(["WON", "GAVE_UP"]),
  guessCount: z.number().int(),
  durationMs: z.number().int(),
  hitGuessCount: z.number().int().nullable(),
  guessAccuracy: z.number().nullable(),
  score: z.number().int(),
  scoreVersion: z.number().int(),
  isOfficial: z.literal(true),
  source: GameResultSourceSchema,
  completedAt: z.string(),
});
export type OfficialResultSummary = z.infer<typeof OfficialResultSummarySchema>;

export const ArchivePuzzleParamSchema = z.object({
  id: z.string().min(1),
});
export type ArchivePuzzleParam = z.infer<typeof ArchivePuzzleParamSchema>;

export const ArchivePuzzleResponseSchema = PublicPuzzleDtoSchema.extend({
  officialResult: OfficialResultSummarySchema.nullable(),
});
export type ArchivePuzzleResponse = z.infer<typeof ArchivePuzzleResponseSchema>;

export const HistoryItemSchema = z.object({
  puzzleId: z.string(),
  puzzleNumber: z.number().int(),
  date: z.string().nullable(),
  source: GameResultSourceSchema,
  status: z.enum(["WON", "GAVE_UP"]),
  won: z.boolean(),
  guessCount: z.number().int(),
  durationMs: z.number().int(),
  hitGuessCount: z.number().int().nullable(),
  guessAccuracy: z.number().nullable(),
  score: z.number().int().nullable(),
  scoreVersion: z.number().int(),
  completedAt: z.string(),
});
export type HistoryItem = z.infer<typeof HistoryItemSchema>;

export const LeaderboardQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(20),
});
export type LeaderboardQuery = z.infer<typeof LeaderboardQuerySchema>;

export const LeaderboardEntrySchema = z.object({
  rank: z.number().int(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  score: z.number().int(),
  isCurrentUser: z.boolean(),
});
export type LeaderboardEntry = z.infer<typeof LeaderboardEntrySchema>;

export const LeaderboardMeSchema = z.object({
  rank: z.number().int(),
  score: z.number().int(),
});
export type LeaderboardMe = z.infer<typeof LeaderboardMeSchema>;

export const LeaderboardTodayResponseSchema = z.object({
  puzzleNumber: z.number().int(),
  date: z.string(),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  entries: z.array(LeaderboardEntrySchema),
  authenticated: z.boolean(),
  played: z.boolean(),
  me: LeaderboardMeSchema.nullable(),
});
export type LeaderboardTodayResponse = z.infer<typeof LeaderboardTodayResponseSchema>;

export const HistoryResponseSchema = z.object({
  items: z.array(HistoryItemSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});
export type HistoryResponse = z.infer<typeof HistoryResponseSchema>;

export const ProfileUpdateRequestSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
});
export type ProfileUpdateRequest = z.infer<typeof ProfileUpdateRequestSchema>;

export const ForgotPasswordRequestSchema = z.object({
  email: z.string().trim().email().max(320),
});
export type ForgotPasswordRequest = z.infer<typeof ForgotPasswordRequestSchema>;

export const ResetPasswordRequestSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
});
export type ResetPasswordRequest = z.infer<typeof ResetPasswordRequestSchema>;

export const VerifyEmailRequestSchema = z.object({
  token: z.string().min(1),
});
export type VerifyEmailRequest = z.infer<typeof VerifyEmailRequestSchema>;

export const ChangePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
});
export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequestSchema>;

export const DeleteAccountRequestSchema = z.object({
  password: z.string().min(1).max(128).optional(),
  confirm: z.literal("DELETE"),
});
export type DeleteAccountRequest = z.infer<typeof DeleteAccountRequestSchema>;
