import { loadConfig, resolveListenHost } from "./infrastructure/config/env.js";
import { buildApp } from "./app.js";
import { logger, setLogLevel } from "./infrastructure/logger.js";
import { disconnectPrisma } from "./infrastructure/postgres/prisma.js";
import { disconnectRedis } from "./infrastructure/redis/redis-client.js";

async function main(): Promise<void> {
  const config = loadConfig();
  setLogLevel(config.LOG_LEVEL);
  const app = await buildApp({ config });

  const shutdown = async (signal: string) => {
    logger.info("shutdown", { signal });
    await app.close();
    await disconnectPrisma();
    await disconnectRedis();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  const host = resolveListenHost();
  await app.listen({ port: config.BACKEND_PORT, host });
  logger.info("startup", {
    port: config.BACKEND_PORT,
    host,
    articleSource: config.ARTICLE_SOURCE,
  });
}

main().catch((error: unknown) => {
  logger.error("fatal_startup_error", {
    message: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
