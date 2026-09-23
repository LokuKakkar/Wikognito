export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export interface ErrorBody {
  error: {
    code: string;
    message: string;
    requestId?: string;
  };
}

export function toErrorResponse(
  error: unknown,
  isDev: boolean,
  requestId?: string,
): { statusCode: number; body: ErrorBody } {
  const withId = (code: string, message: string) => ({
    error: requestId ? { code, message, requestId } : { code, message },
  });

  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      body: withId(error.code, error.message),
    };
  }

  if (error && typeof error === "object" && "statusCode" in error) {
    const e = error as { code?: string; statusCode: number; message?: string };
    if (e.statusCode === 429) {
      return {
        statusCode: 429,
        body: withId("RATE_LIMITED", "Too many requests."),
      };
    }
    if (e.code && e.statusCode >= 400 && e.statusCode < 600) {
      return {
        statusCode: e.statusCode,
        body: withId(e.code, e.message ?? "Request failed."),
      };
    }
  }

  return {
    statusCode: 500,
    body: withId(
      "INTERNAL_ERROR",
      isDev && error instanceof Error ? error.message : "An unexpected error occurred.",
    ),
  };
}

export function isAuthFailure(error: unknown, statusCode: number): boolean {
  if (statusCode === 401 || statusCode === 403) return true;
  if (error instanceof AppError) {
    return (
      error.code.includes("CREDENTIAL") ||
      error.code.includes("UNAUTHENTICATED") ||
      error.code.includes("OAUTH") ||
      error.code === "INVALID_TOKEN"
    );
  }
  return false;
}
