import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password.js";

describe("password hashing", () => {
  it("verifies the original password and rejects others", async () => {
    const stored = await hashPassword("redactle-admin");
    expect(await verifyPassword("redactle-admin", stored)).toBe(true);
    expect(await verifyPassword("wrong-password", stored)).toBe(false);
    expect(await verifyPassword("redactle-admin", "not-a-hash")).toBe(false);
  });
});

describe("hash concurrency cap", () => {
  it("sheds load with a 503 instead of queueing without bound", async () => {
    const attempts = Array.from({ length: 40 }, () =>
      hashPassword("correct horse battery staple").then(
        () => "ok" as const,
        (error: unknown) => error,
      ),
    );
    const outcomes = await Promise.all(attempts);
    const rejected = outcomes.filter((outcome) => outcome !== "ok");
    expect(outcomes.filter((outcome) => outcome === "ok").length).toBeGreaterThan(0);
    expect(rejected.length).toBeGreaterThan(0);
    expect(rejected[0]).toMatchObject({ code: "SERVER_BUSY", statusCode: 503 });
  });
});
