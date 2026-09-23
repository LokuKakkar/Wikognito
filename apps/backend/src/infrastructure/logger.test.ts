import { describe, expect, it } from "vitest";
import { redactValue } from "./logger.js";

describe("redactValue", () => {
  it("redacts passwords, tokens, cookies, and bearer headers", () => {
    const redacted = redactValue({
      password: "hunter2",
      token: "reset-token",
      authorization: "Bearer abc.def",
      cookie: "redactle_session=abc",
      nested: { clientSecret: "google-secret" },
      note: "Bearer leaked-token",
    }) as Record<string, unknown>;

    expect(redacted.password).toBe("[redacted]");
    expect(redacted.token).toBe("[redacted]");
    expect(redacted.authorization).toBe("[redacted]");
    expect(redacted.cookie).toBe("[redacted]");
    expect((redacted.nested as { clientSecret: string }).clientSecret).toBe("[redacted]");
    expect(redacted.note).toBe("Bearer [redacted]");
  });
});
