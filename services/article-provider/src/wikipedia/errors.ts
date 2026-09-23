export class WikipediaUrlError extends Error {
  readonly code = "VALIDATION_ERROR";
  readonly statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = "WikipediaUrlError";
  }
}

export class WikipediaProviderError extends Error {
  constructor(
    message: string,
    public readonly code: "NOT_FOUND" | "WIKIPEDIA_ERROR" | "VALIDATION_ERROR" | "IMPORT_ERROR",
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "WikipediaProviderError";
  }
}
