import type { Redis } from "ioredis";
import {
  REDIS_SESSION_KEY_PREFIX,
  SessionStateSchema,
  type SessionState,
} from "@redactle/shared";

/**
 * Redis-backed session repository.
 * Controllers must not call Redis directly — go through SessionService → SessionRepository.
 */
export class SessionRepository {
  constructor(
    private readonly redis: Redis,
    private readonly ttlSeconds: number,
  ) {}

  private key(sessionId: string): string {
    return `${REDIS_SESSION_KEY_PREFIX}${sessionId}`;
  }

  async get(sessionId: string): Promise<SessionState | null> {
    const raw = await this.redis.get(this.key(sessionId));
    if (!raw) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      const result = SessionStateSchema.safeParse(parsed);
      return result.success ? result.data : null;
    } catch {
      return null;
    }
  }

  async set(sessionId: string, state: SessionState): Promise<void> {
    await this.redis.set(this.key(sessionId), JSON.stringify(state), "EX", this.ttlSeconds);
  }

  async delete(sessionId: string): Promise<void> {
    await this.redis.del(this.key(sessionId));
  }
}
