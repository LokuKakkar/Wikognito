import { describe, expect, it } from "vitest";
import { timingSafeEqualSecret } from "./secrets.js";

describe("timingSafeEqualSecret", () => {
  it("accepts only an exact match", () => {
    expect(timingSafeEqualSecret("publish-secret", "publish-secret")).toBe(true);
    expect(timingSafeEqualSecret("nope", "publish-secret")).toBe(false);
    expect(timingSafeEqualSecret("", "publish-secret")).toBe(false);
  });
});
