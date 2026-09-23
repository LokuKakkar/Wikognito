import { describe, expect, it } from "vitest";
import { redisClientOptions } from "./redis-client.js";

describe("redisClientOptions", () => {
  it("retries reconnects instead of crashing the process", () => {
    const options = redisClientOptions();
    expect(options.maxRetriesPerRequest).toBe(1);
    expect(options.enableOfflineQueue).toBe(false);
    expect(options.retryStrategy?.(1)).toBe(200);
    expect(options.retryStrategy?.(20)).toBe(2000);
    expect(options.reconnectOnError?.(new Error("timeout"))).toBe(true);
  });
});
