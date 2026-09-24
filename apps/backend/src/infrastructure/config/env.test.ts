import { describe, expect, it } from "vitest";
import {
  formatProductionVerifyOutput,
  isLocalFrontendOrigin,
  loadConfig,
  PRODUCTION_CHECKED_KEYS,
  resolveListenHost,
  resolveListenPort,
} from "./env.js";

const base = {
  DATABASE_URL: "postgresql://redactle:redactle_dev@localhost:5433/redactle",
  REDIS_URL: "redis://localhost:6380",
};

describe("loadConfig", () => {
  it("fails fast when required URLs are missing", () => {
    expect(() => loadConfig({ NODE_ENV: "development" })).toThrow(/DATABASE_URL/);
  });

  it("rejects localhost FRONTEND_ORIGIN in production", () => {
    expect(() =>
      loadConfig({
        ...base,
        NODE_ENV: "production",
        FRONTEND_ORIGIN: "http://localhost:3002",
      }),
    ).toThrow(/FRONTEND_ORIGIN/);
  });

  it("accepts a public production origin", () => {
    const config = loadConfig({
      ...base,
      NODE_ENV: "production",
      FRONTEND_ORIGIN: "https://play.wikognito.test",
    });
    expect(config.FRONTEND_ORIGIN).toBe("https://play.wikognito.test");
    expect(config.RATE_LIMIT_ENABLED).toBe(true);
  });

  it("disables rate limiting by default in test", () => {
    const config = loadConfig({ ...base, NODE_ENV: "test" });
    expect(config.RATE_LIMIT_ENABLED).toBe(false);
  });

  it("prefers PORT over BACKEND_PORT", () => {
    const config = loadConfig({ ...base, PORT: "10000", BACKEND_PORT: "4000" });
    expect(config.BACKEND_PORT).toBe(10000);
  });

  it("uses BACKEND_PORT when PORT is unset", () => {
    const config = loadConfig({ ...base, BACKEND_PORT: "4001" });
    expect(config.BACKEND_PORT).toBe(4001);
  });

  it("ignores a blank PORT", () => {
    const config = loadConfig({ ...base, PORT: "   ", BACKEND_PORT: "4001" });
    expect(config.BACKEND_PORT).toBe(4001);
  });

  it("rejects a non-numeric PORT", () => {
    expect(() => loadConfig({ ...base, PORT: "abc" })).toThrow(/PORT/);
  });
});

describe("listen address", () => {
  it("defaults the host to all interfaces", () => {
    expect(resolveListenHost({})).toBe("0.0.0.0");
    expect(resolveListenPort({})).toBe(4000);
  });

  it("uses HOST when set", () => {
    expect(resolveListenHost({ HOST: "127.0.0.1" })).toBe("127.0.0.1");
  });
});

describe("production verify output", () => {
  it("lists key names and never prints secret values", () => {
    const output = formatProductionVerifyOutput(PRODUCTION_CHECKED_KEYS);
    expect(output).toContain("DATABASE_URL");
    expect(output).toContain("values hidden");
    expect(output).not.toContain("postgresql://");
    expect(output).not.toContain("redactle_dev");
    expect(output).not.toContain("redis://");
  });

  it("treats loopback hosts as local origins", () => {
    expect(isLocalFrontendOrigin("http://127.0.0.1:3002")).toBe(true);
    expect(isLocalFrontendOrigin("https://play.wikognito.test")).toBe(false);
  });
});
