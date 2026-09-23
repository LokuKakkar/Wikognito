import { createHash, randomBytes } from "node:crypto";

export const VERIFY_EMAIL_TTL_MS = 60 * 60 * 1000;
export const RESET_PASSWORD_TTL_MS = 30 * 60 * 1000;

export function createAuthToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashAuthToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
