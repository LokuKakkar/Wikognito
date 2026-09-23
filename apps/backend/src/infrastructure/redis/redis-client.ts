import { Redis, type RedisOptions } from "ioredis";
import type { AppConfig } from "../config/env.js";
import { logger } from "../logger.js";

let redis: Redis | null = null;

export function redisClientOptions(): RedisOptions & { lazyConnect: true } {
  return {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy(times: number): number {
      return Math.min(times * 200, 2000);
    },
    reconnectOnError(): boolean {
      return true;
    },
  };
}

function attachRedisHandlers(client: Redis): void {
  client.on("error", (error: Error) => {
    logger.warn("redis_error", { message: error.message });
  });
  client.on("reconnecting", () => {
    logger.info("redis_reconnecting");
  });
  client.on("ready", () => {
    logger.info("redis_ready");
  });
}

export function getRedis(config: AppConfig): Redis {
  if (!redis) {
    redis = new Redis(config.REDIS_URL, redisClientOptions());
    attachRedisHandlers(redis);
  }
  return redis;
}

export async function ensureRedisConnected(config: AppConfig): Promise<Redis> {
  const client = getRedis(config);
  if (client.status === "wait") {
    await client.connect();
  }
  return client;
}

export async function tryConnectRedis(config: AppConfig): Promise<boolean> {
  try {
    await ensureRedisConnected(config);
    return true;
  } catch (error) {
    logger.warn("redis_unavailable_at_startup", {
      message: error instanceof Error ? error.message : "Redis unavailable",
    });
    return false;
  }
}

export async function checkRedisHealth(
  config: AppConfig,
): Promise<{ status: "ok" | "error"; message?: string }> {
  try {
    const client = getRedis(config);
    if (client.status === "wait") {
      await client.connect();
    }
    const pong = await client.ping();
    if (pong !== "PONG") {
      return { status: "error", message: `Unexpected ping response: ${pong}` };
    }
    return { status: "ok" };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Redis unavailable",
    };
  }
}

export async function disconnectRedis(): Promise<void> {
  if (redis) {
    redis.removeAllListeners();
    await redis.quit().catch(() => undefined);
    redis = null;
  }
}
