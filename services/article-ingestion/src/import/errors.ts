export class ImportError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "ImportError";
  }
}

export function toImportError(error: unknown): ImportError {
  if (error instanceof ImportError) {
    return error;
  }
  if (error && typeof error === "object" && "code" in error && "statusCode" in error) {
    const e = error as { code: string; statusCode: number; message: string };
    return new ImportError(e.code, e.message, e.statusCode);
  }
  return new ImportError(
    "IMPORT_ERROR",
    error instanceof Error ? error.message : "Failed to import Wikipedia article.",
    500,
  );
}
