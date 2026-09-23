import type { PrismaClient, Session, User } from "@prisma/client";

export type IdentitySessionWithUser = Session & { user: User | null };

export class IdentitySessionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async upsert(sessionId: string, ttlSeconds: number): Promise<Session> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
    return this.prisma.session.upsert({
      where: { id: sessionId },
      create: {
        id: sessionId,
        expiresAt,
        lastSeenAt: now,
      },
      update: {
        lastSeenAt: now,
        expiresAt,
      },
    });
  }

  async findWithUser(sessionId: string): Promise<IdentitySessionWithUser | null> {
    return this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });
  }

  async attachUser(sessionId: string, userId: string): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { userId },
    });
  }

  async clearUser(sessionId: string): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { userId: null },
    });
  }

  async listByUserId(userId: string): Promise<Session[]> {
    return this.prisma.session.findMany({ where: { userId } });
  }

  async clearUserForAccount(userId: string): Promise<Session[]> {
    const sessions = await this.listByUserId(userId);
    await this.prisma.session.updateMany({
      where: { userId },
      data: { userId: null },
    });
    return sessions;
  }
}
