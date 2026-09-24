import { config as loadEnv } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  SESSION_COOKIE_NAME_DEFAULT,
  SESSION_TTL_SECONDS_DEFAULT,
  FRONTEND_ORIGIN_DEFAULT,
  GOOGLE_REDIRECT_URI_DEFAULT,
} from "@redactle/shared";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, "../../../../../.env") });

const optionalBoolean = z
  .enum(["true", "false", "1", "0"])
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined;
    return value === "true" || value === "1";
  });

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),
  BACKEND_PORT: z.coerce.number().int().positive().default(4000),
  SESSION_COOKIE_NAME: z.string().default(SESSION_COOKIE_NAME_DEFAULT),
  SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(SESSION_TTL_SECONDS_DEFAULT),
  ARTICLE_SOURCE: z.enum(["LOCAL", "WIKIPEDIA"]).default("LOCAL"),
  WIKIPEDIA_API_URL: z.string().optional().default("https://en.wikipedia.org/w/api.php"),
  WIKIPEDIA_USER_AGENT: z.string().optional().default(""),
  WIKIPEDIA_REQUEST_DELAY_MS: z.coerce.number().int().nonnegative().default(500),
  PUZZLE_GENERATOR_VERSION: z.string().default("2.0.0"),
  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),
  GOOGLE_REDIRECT_URI: z.string().optional().default(GOOGLE_REDIRECT_URI_DEFAULT),
  FRONTEND_ORIGIN: z.string().optional().default(FRONTEND_ORIGIN_DEFAULT),
  GOOGLE_ADMIN_EMAILS: z.string().optional().default(""),
  SMTP_URL: z.string().optional().default(""),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  PUBLISH_SECRET: z.string().optional().default(""),
  RATE_LIMIT_ENABLED: optionalBoolean,
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_GAME_MAX: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_ADMIN_MAX: z.coerce.number().int().positive().default(30),
  RATE_LIMIT_PUBLIC_MAX: z.coerce.number().int().positive().default(120),
});

export type AppConfig = z.infer<typeof EnvSchema> & {
  RATE_LIMIT_ENABLED: boolean;
};

export const PRODUCTION_CHECKED_KEYS = [
  "NODE_ENV",
  "DATABASE_URL",
  "REDIS_URL",
  "FRONTEND_ORIGIN",
  "BACKEND_PORT",
  "NEXT_PUBLIC_API_BASE_URL",
] as const;

export function isLocalFrontendOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return true;
  }
}

/** Render injects PORT. Local dev keeps BACKEND_PORT (default 4000) when PORT is unset. */
export function resolveListenPort(env: NodeJS.ProcessEnv): number {
  const fromPlatform = env.PORT?.trim();
  const raw = fromPlatform || env.BACKEND_PORT?.trim() || "4000";
  if (!/^[0-9]+$/.test(raw)) {
    throw new Error("Invalid configuration: PORT/BACKEND_PORT must be a positive integer");
  }
  const port = Number(raw);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error("Invalid configuration: PORT/BACKEND_PORT must be a positive integer");
  }
  return port;
}

/** Local and Render both bind all interfaces unless HOST is set. */
export function resolveListenHost(env: NodeJS.ProcessEnv = process.env): string {
  const host = env.HOST?.trim();
  return host ? host : "0.0.0.0";
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = EnvSchema.safeParse({
    ...env,
    BACKEND_PORT: String(resolveListenPort(env)),
  });
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid configuration: ${details}`);
  }

  const data = parsed.data;
  if (data.NODE_ENV === "production" && isLocalFrontendOrigin(data.FRONTEND_ORIGIN)) {
    throw new Error(
      "Invalid configuration: FRONTEND_ORIGIN must be a non-localhost origin in production",
    );
  }

  return {
    ...data,
    RATE_LIMIT_ENABLED: data.RATE_LIMIT_ENABLED ?? data.NODE_ENV !== "test",
  };
}

export function formatProductionVerifyOutput(keys: readonly string[]): string {
  return [
    "Wikognito production configuration",
    "Checked keys (values hidden):",
    ...keys.map((key) => `- ${key}`),
    "OK",
  ].join("\n");
}
