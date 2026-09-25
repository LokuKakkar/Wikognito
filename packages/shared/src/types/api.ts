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
  q: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value) => (value ? value : undefined)),
});
export type ArticleListQuery = z.infer<typeof ArticleListQuerySchema>;
export const DossierListQuerySchema = ArticleListQuerySchema;
export type DossierListQuery = ArticleListQuery;

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

export const PuzzleListQuerySchema = ArticleListQuerySchema;
export type PuzzleListQuery = ArticleListQuery;

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
  status: z.enum(["PUBLISHED", "ALREADY_PUBLISHED", "NO_CANDIDATE"]),
  date: z.string(),
  puzzleId: z.string().optional(),
  puzzleNumber: z.number().int().optional(),
  title: z.string().optional(),
});
export type PublishTodayResponse = z.infer<typeof PublishTodayResponseSchema>;

export const DossierStatusSchema = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);
export type DossierStatus = z.infer<typeof DossierStatusSchema>;

export const DossierPlayStateSchema = z.enum(["SOLVED", "UNSOLVED"]);
export type DossierPlayState = z.infer<typeof DossierPlayStateSchema>;

export const DossierListItemSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  coverImage: z.string().nullable(),
  caseCount: z.number().int(),
});
export type DossierListItem = z.infer<typeof DossierListItemSchema>;

export const DossierListResponseSchema = z.object({
  items: z.array(DossierListItemSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});
export type DossierListResponse = z.infer<typeof DossierListResponseSchema>;

export const DossierCaseFileSchema = z.object({
  id: z.string(),
  position: z.number().int(),
  title: z.string().nullable(),
  titleWordLengths: z.array(z.number().int().positive()),
  puzzleId: z.string(),
  playState: DossierPlayStateSchema,
});
export type DossierCaseFile = z.infer<typeof DossierCaseFileSchema>;

export const DossierDetailSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  coverImage: z.string().nullable(),
  status: DossierStatusSchema,
  caseCount: z.number().int(),
  solvedCount: z.number().int(),
  closed: z.boolean(),
  cases: z.array(DossierCaseFileSchema),
});
export type DossierDetail = z.infer<typeof DossierDetailSchema>;

export const DossierSlugParamSchema = z.object({
  slug: z.string().min(1),
});
export type DossierSlugParam = z.infer<typeof DossierSlugParamSchema>;

export const DossierCaseParamSchema = z.object({
  slug: z.string().min(1),
  caseId: z.string().min(1),
});
export type DossierCaseParam = z.infer<typeof DossierCaseParamSchema>;

export const CreateDossierRequestSchema = z.object({
  slug: z.string().trim().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional().default(""),
  coverImage: z.string().trim().max(500).nullable().optional(),
});
export type CreateDossierRequest = z.infer<typeof CreateDossierRequestSchema>;

export const UpdateDossierRequestSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(1000).optional(),
  coverImage: z.string().trim().max(500).nullable().optional(),
  status: DossierStatusSchema.optional(),
});
export type UpdateDossierRequest = z.infer<typeof UpdateDossierRequestSchema>;

export const AddDossierCaseRequestSchema = z
  .object({
    puzzleId: z.string().min(1).optional(),
    articleId: z.string().min(1).optional(),
  })
  .refine((value) => Boolean(value.puzzleId || value.articleId), {
    message: "puzzleId or articleId is required.",
  });
export type AddDossierCaseRequest = z.infer<typeof AddDossierCaseRequestSchema>;

export const ReorderDossierCaseRequestSchema = z.object({
  position: z.number().int().positive(),
});
export type ReorderDossierCaseRequest = z.infer<typeof ReorderDossierCaseRequestSchema>;

export const AdminDossierIdParamSchema = z.object({
  id: z.string().min(1),
});
export type AdminDossierIdParam = z.infer<typeof AdminDossierIdParamSchema>;

export const AdminDossierCaseParamSchema = z.object({
  id: z.string().min(1),
  caseId: z.string().min(1),
});
export type AdminDossierCaseParam = z.infer<typeof AdminDossierCaseParamSchema>;

export const AdminDossierSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  coverImage: z.string().nullable(),
  status: DossierStatusSchema,
  caseCount: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AdminDossierSummary = z.infer<typeof AdminDossierSummarySchema>;

export const AdminDossierListResponseSchema = z.object({
  items: z.array(AdminDossierSummarySchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});
export type AdminDossierListResponse = z.infer<typeof AdminDossierListResponseSchema>;

export const AdminDossierCaseSchema = z.object({
  id: z.string(),
  position: z.number().int(),
  puzzleId: z.string(),
  articleId: z.string(),
  title: z.string(),
  puzzleStatus: z.enum(["DRAFT", "READY", "PUBLISHED", "ARCHIVED"]),
});
export type AdminDossierCase = z.infer<typeof AdminDossierCaseSchema>;

export const AdminDossierDetailSchema = AdminDossierSummarySchema.extend({
  cases: z.array(AdminDossierCaseSchema),
});
export type AdminDossierDetail = z.infer<typeof AdminDossierDetailSchema>;

export const CorpusProcessRequestSchema = z.object({
  urls: z.array(z.string().min(1)).min(1).max(50),
});
export type CorpusProcessRequest = z.infer<typeof CorpusProcessRequestSchema>;

export const CorpusItemResultSchema = z.object({
  url: z.string(),
  title: z.string().optional(),
  articleId: z.string().optional(),
  puzzleId: z.string().optional(),
  articleStatus: z.enum(["imported", "already_exists", "failed"]),
  puzzleStatus: z.enum(["generated", "already_exists", "failed", "skipped"]),
  stage: z
    .enum([
      "NORMALIZATION",
      "WIKIPEDIA_FETCH",
      "PERSIST_ARTICLE",
      "GENERATE_PUZZLE",
      "VALIDATE_PUZZLE",
      "DOSSIER_LINK",
    ])
    .optional(),
  error: z.string().optional(),
});
export type CorpusItemResult = z.infer<typeof CorpusItemResultSchema>;

export const CorpusProcessResponseSchema = z.object({
  total: z.number().int(),
  imported: z.number().int(),
  alreadyExisting: z.number().int(),
  puzzlesGenerated: z.number().int(),
  puzzlesAlreadyExisting: z.number().int(),
  failed: z.number().int(),
  items: z.array(CorpusItemResultSchema),
});
export type CorpusProcessResponse = z.infer<typeof CorpusProcessResponseSchema>;

export const DossierSeedRequestSchema = z.object({
  slug: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional(),
  coverImage: z.string().trim().max(500).nullable().optional(),
  status: DossierStatusSchema.optional(),
  articles: z.array(z.string().min(1)).min(1).max(50),
});
export type DossierSeedRequest = z.infer<typeof DossierSeedRequestSchema>;

export const DossierSeedResponseSchema = z.object({
  dossierId: z.string(),
  slug: z.string(),
  created: z.boolean(),
  casesAdded: z.number().int(),
  casesAlreadyExisting: z.number().int(),
  corpus: CorpusProcessResponseSchema,
  failed: z.array(
    z.object({
      url: z.string(),
      stage: z.string(),
      error: z.string(),
    }),
  ),
});
export type DossierSeedResponse = z.infer<typeof DossierSeedResponseSchema>;

export const PuzzlePoolStatsSchema = z.object({
  readyUnused: z.number().int(),
  usedInDaily: z.number().int(),
  dossierLinked: z.number().int(),
  oldestReady: z
    .object({
      id: z.string(),
      title: z.string(),
      createdAt: z.string(),
    })
    .nullable(),
  newestReady: z
    .object({
      id: z.string(),
      title: z.string(),
      createdAt: z.string(),
    })
    .nullable(),
  warningThreshold: z.number().int(),
  lowPool: z.boolean(),
});
export type PuzzlePoolStats = z.infer<typeof PuzzlePoolStatsSchema>;

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

export const DossierCasePuzzleResponseSchema = PublicPuzzleDtoSchema.extend({
  officialResult: OfficialResultSummarySchema.nullable(),
});
export type DossierCasePuzzleResponse = z.infer<typeof DossierCasePuzzleResponseSchema>;

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
