import type {
  ArchiveListResponse,
  ArchivePuzzleResponse,
  ArticleListResponse,
  CompleteGameRequest,
  GameResultResponse,
  GeneratePuzzleResponse,
  HistoryResponse,
  ImportArticleResponse,
  LeaderboardTodayResponse,
  MeResponse,
  OfficialResultSummary,
  PuzzleStats,
  PublicPuzzleDto,
  PublishTodayResponse,
  PuzzleListResponse,
  SessionState,
  SessionSyncRequest,
  StatsResponse,
  UserStatsResponse,
  ValidatePuzzlesResponse,
} from "@redactle/shared";
import { decodeClientPayload } from "@redactle/puzzle-engine";
import type { ClientPuzzle } from "@redactle/shared";

// Prefer an explicit public API URL. Empty string must not win over the default
// (Next may leave missing NEXT_PUBLIC_* as "" via the process polyfill).
const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE_URL && process.env.NEXT_PUBLIC_API_BASE_URL.trim().length > 0
    ? process.env.NEXT_PUBLIC_API_BASE_URL.trim()
    : "http://localhost:4000"
).replace(/\/$/, "");

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { message?: string; code?: string };
    } | null;
    throw new ApiRequestError(
      body?.error?.message ?? `Request failed: ${response.status}`,
      response.status,
      body?.error?.code,
    );
  }

  return (await response.json()) as T;
}

export async function fetchTodayPuzzle(): Promise<ClientPuzzle> {
  const dto = await apiFetch<PublicPuzzleDto>("/api/puzzles/today");
  return decodeClientPayload(dto.payload);
}

export function fetchCurrentSession(): Promise<SessionState | undefined> {
  return apiFetch<SessionState | undefined>("/api/sessions/current");
}

export function syncSession(payload: SessionSyncRequest): Promise<SessionState> {
  return apiFetch<SessionState>("/api/sessions/sync", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function completeGame(payload: CompleteGameRequest): Promise<GameResultResponse> {
  return apiFetch<GameResultResponse>("/api/games/complete", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchStats(): Promise<StatsResponse> {
  return apiFetch<StatsResponse>("/api/stats");
}

export function googleAuthUrl(): string {
  return `${API_BASE}/api/auth/google`;
}

export async function fetchMe(): Promise<MeResponse | null> {
  try {
    return await apiFetch<MeResponse>("/api/me");
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 401) {
      return null;
    }
    throw error;
  }
}

export function fetchUserStats(): Promise<UserStatsResponse> {
  return apiFetch<UserStatsResponse>("/api/me/stats");
}

export function fetchPuzzleStats(puzzleId: string): Promise<PuzzleStats> {
  return apiFetch<PuzzleStats>(`/api/puzzles/${encodeURIComponent(puzzleId)}/stats`);
}

export function logout(): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>("/api/auth/logout", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function loginWithEmail(email: string, password: string): Promise<MeResponse> {
  return apiFetch<MeResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function registerWithEmail(
  email: string,
  password: string,
  displayName?: string,
): Promise<MeResponse> {
  return apiFetch<MeResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, displayName }),
  });
}

export function importWikipediaArticle(url: string): Promise<ImportArticleResponse> {
  return apiFetch<ImportArticleResponse>("/api/admin/articles/import", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}

export function fetchAdminArticles(page = 1, pageSize = 20): Promise<ArticleListResponse> {
  return apiFetch<ArticleListResponse>(`/api/admin/articles?page=${page}&pageSize=${pageSize}`);
}

export async function fetchAdminArticlePuzzle(articleId: string): Promise<ClientPuzzle> {
  const encoded = encodeURIComponent(articleId);
  const dto = await apiFetch<PublicPuzzleDto>(`/api/admin/articles/${encoded}/puzzle`);
  return decodeClientPayload(dto.payload);
}

export function fetchAdminPuzzles(page = 1, pageSize = 20): Promise<PuzzleListResponse> {
  return apiFetch<PuzzleListResponse>(`/api/admin/puzzles?page=${page}&pageSize=${pageSize}`);
}

export function generateAdminPuzzle(articleId: string, force = false): Promise<GeneratePuzzleResponse> {
  return apiFetch<GeneratePuzzleResponse>("/api/admin/puzzles/generate", {
    method: "POST",
    body: JSON.stringify({ articleId, force }),
  });
}

export function validateAdminPuzzles(): Promise<ValidatePuzzlesResponse> {
  return apiFetch<ValidatePuzzlesResponse>("/api/admin/puzzles/validate", {
    method: "POST",
  });
}

export function publishTodayPuzzle(): Promise<PublishTodayResponse> {
  return apiFetch<PublishTodayResponse>("/api/admin/puzzles/publish-today", {
    method: "POST",
  });
}

export function fetchArchiveList(page = 1, pageSize = 20): Promise<ArchiveListResponse> {
  return apiFetch<ArchiveListResponse>(`/api/puzzles/archive?page=${page}&pageSize=${pageSize}`);
}

export async function fetchArchivePuzzle(puzzleId: string): Promise<{
  puzzle: ClientPuzzle;
  officialResult: OfficialResultSummary | null;
}> {
  const encoded = encodeURIComponent(puzzleId);
  const dto = await apiFetch<ArchivePuzzleResponse>(`/api/puzzles/archive/${encoded}`);
  return {
    puzzle: decodeClientPayload(dto.payload),
    officialResult: dto.officialResult,
  };
}

export function fetchHistory(page = 1, pageSize = 20): Promise<HistoryResponse> {
  return apiFetch<HistoryResponse>(`/api/me/history?page=${page}&pageSize=${pageSize}`);
}

export function fetchTodayLeaderboard(page = 1, pageSize = 20): Promise<LeaderboardTodayResponse> {
  return apiFetch<LeaderboardTodayResponse>(`/api/leaderboard/today?page=${page}&pageSize=${pageSize}`);
}

export function updateProfile(displayName: string): Promise<MeResponse> {
  return apiFetch<MeResponse>("/api/me/profile", {
    method: "PATCH",
    body: JSON.stringify({ displayName }),
  });
}

export function verifyEmail(token: string): Promise<MeResponse> {
  return apiFetch<MeResponse>("/api/auth/email/verify", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export function resendVerification(): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>("/api/auth/email/resend", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function forgotPassword(email: string): Promise<{ ok: true; message: string }> {
  return apiFetch<{ ok: true; message: string }>("/api/auth/password/forgot", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function resetPassword(token: string, password: string): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>("/api/auth/password/reset", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });
}

export function changePassword(currentPassword: string, newPassword: string): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>("/api/me/password/change", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export function deleteAccount(confirm: "DELETE", password?: string): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>("/api/me", {
    method: "DELETE",
    body: JSON.stringify({ confirm, password }),
  });
}
