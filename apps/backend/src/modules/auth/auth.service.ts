import {
  Prisma,
  type AuthIdentity,
  type AuthTokenType,
  type PrismaClient,
  type User,
  type UserRole,
} from "@prisma/client";
import type { MeResponse } from "@redactle/shared";
import type { IdentitySessionRepository } from "../identity/identity-session.repository.js";
import type { SessionRepository } from "../sessions/session.repository.js";
import type { GameRepository } from "../games/game.repository.js";
import type { GoogleProfile } from "./google-oauth.js";
import { hashPassword, verifyPassword } from "./password.js";
import { AppError } from "../errors.js";
import type { Mailer } from "./mailer.js";
import { createAuthToken, hashAuthToken, RESET_PASSWORD_TTL_MS, VERIFY_EMAIL_TTL_MS } from "./tokens.js";

const GENERIC_RESET_MESSAGE =
  "If an account exists for this email, a password reset link has been sent.";

function parseAdminEmails(raw: string): Set<string> {
  return new Set(
    raw
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
}

function roleForEmail(email: string | null, adminEmails: Set<string>): UserRole {
  if (email && adminEmails.has(email.toLowerCase())) {
    return "ADMIN";
  }
  return "USER";
}

type UserWithIdentities = User & { identities: AuthIdentity[] };

export function toMeResponse(user: UserWithIdentities): MeResponse {
  return {
    id: user.id,
    displayName: user.displayName,
    email: user.email,
    avatarUrl: user.avatarUrl,
    role: user.role,
    emailVerified: Boolean(user.emailVerifiedAt),
    hasPassword: user.identities.some((identity) => identity.provider === "EMAIL" && Boolean(identity.passwordHash)),
    providers: user.identities.map((identity) => identity.provider),
  };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export class AuthService {
  private readonly adminEmails: Set<string>;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly identitySessions: IdentitySessionRepository,
    private readonly redisSessions: SessionRepository,
    private readonly games: GameRepository,
    adminEmailsRaw: string,
    private readonly mailer: Mailer,
    private readonly frontendOrigin: string,
  ) {
    this.adminEmails = parseAdminEmails(adminEmailsRaw);
  }

  async getMe(userId: string): Promise<MeResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { identities: true },
    });
    if (!user) {
      throw new AppError("UNAUTHENTICATED", "Authentication required.", 401);
    }
    return toMeResponse(user);
  }

  async authenticateGoogleProfile(sessionId: string, profile: GoogleProfile): Promise<User> {
    const user = await this.findOrCreateGoogleUser(profile);
    await this.claimAnonymousSession(sessionId, user.id);
    return user;
  }

  async registerWithEmail(
    sessionId: string,
    input: { email: string; password: string; displayName?: string },
  ): Promise<MeResponse> {
    const email = normalizeEmail(input.email);
    const role = roleForEmail(email, this.adminEmails);
    const passwordHash = await hashPassword(input.password);
    const displayName = input.displayName?.trim() || email.split("@")[0] || "Player";

    const existingIdentity = await this.prisma.authIdentity.findUnique({
      where: {
        provider_providerSubject: { provider: "EMAIL", providerSubject: email },
      },
    });
    if (existingIdentity) {
      throw new AppError("EMAIL_TAKEN", "An account with this email already exists.", 409);
    }

    try {
      const user = await this.prisma.user.create({
        data: {
          role,
          email,
          displayName,
          identities: {
            create: {
              provider: "EMAIL",
              providerSubject: email,
              passwordHash,
            },
          },
        },
        include: { identities: true },
      });
      await this.claimAnonymousSession(sessionId, user.id);
      await this.issueToken(user.id, "VERIFY_EMAIL", VERIFY_EMAIL_TTL_MS, email);
      return toMeResponse(user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new AppError("EMAIL_TAKEN", "An account with this email already exists.", 409);
      }
      throw error;
    }
  }

  async loginWithEmail(
    sessionId: string,
    input: { email: string; password: string },
  ): Promise<MeResponse> {
    const email = normalizeEmail(input.email);
    const identity = await this.prisma.authIdentity.findUnique({
      where: {
        provider_providerSubject: { provider: "EMAIL", providerSubject: email },
      },
      include: { user: { include: { identities: true } } },
    });
    if (!identity?.passwordHash) {
      throw new AppError("INVALID_CREDENTIALS", "Invalid email or password.", 401);
    }
    const ok = await verifyPassword(input.password, identity.passwordHash);
    if (!ok) {
      throw new AppError("INVALID_CREDENTIALS", "Invalid email or password.", 401);
    }

    const role = roleForEmail(email, this.adminEmails);
    const user =
      identity.user.role === role
        ? identity.user
        : await this.prisma.user.update({
            where: { id: identity.userId },
            data: { role },
            include: { identities: true },
          });
    await this.claimAnonymousSession(sessionId, user.id);
    return toMeResponse(user);
  }

  async logout(sessionId: string): Promise<void> {
    await this.identitySessions.clearUser(sessionId);
    const redis = await this.redisSessions.get(sessionId);
    if (redis) {
      await this.redisSessions.set(sessionId, { ...redis, userId: null });
    }
  }

  async verifyEmail(rawToken: string): Promise<MeResponse> {
    const token = await this.consumeToken(rawToken, "VERIFY_EMAIL");
    const user = await this.prisma.user.update({
      where: { id: token.userId },
      data: { emailVerifiedAt: new Date() },
      include: { identities: true },
    });
    return toMeResponse(user);
  }

  async resendVerification(userId: string): Promise<{ ok: true }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { identities: true },
    });
    if (!user?.email || user.emailVerifiedAt) {
      return { ok: true };
    }
    const hasPassword = user.identities.some(
      (identity) => identity.provider === "EMAIL" && Boolean(identity.passwordHash),
    );
    if (!hasPassword) {
      return { ok: true };
    }
    await this.issueToken(user.id, "VERIFY_EMAIL", VERIFY_EMAIL_TTL_MS, user.email);
    return { ok: true };
  }

  async forgotPassword(emailRaw: string): Promise<{ ok: true; message: string }> {
    const email = normalizeEmail(emailRaw);
    const identity = await this.prisma.authIdentity.findUnique({
      where: {
        provider_providerSubject: { provider: "EMAIL", providerSubject: email },
      },
      include: { user: true },
    });
    if (identity?.passwordHash && identity.user.email) {
      await this.issueToken(identity.userId, "RESET_PASSWORD", RESET_PASSWORD_TTL_MS, identity.user.email);
    }
    return { ok: true, message: GENERIC_RESET_MESSAGE };
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<{ ok: true }> {
    const token = await this.consumeToken(rawToken, "RESET_PASSWORD");
    const identity = await this.prisma.authIdentity.findFirst({
      where: { userId: token.userId, provider: "EMAIL" },
    });
    if (!identity) {
      throw new AppError("INVALID_TOKEN", "This reset link is invalid or has expired.", 400);
    }
    await this.prisma.authIdentity.update({
      where: { id: identity.id },
      data: { passwordHash: await hashPassword(newPassword) },
    });
    await this.detachAllSessions(token.userId);
    return { ok: true };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ ok: true }> {
    const identity = await this.prisma.authIdentity.findFirst({
      where: { userId, provider: "EMAIL" },
    });
    if (!identity?.passwordHash) {
      throw new AppError("NO_PASSWORD", "This account does not have a local password.", 400);
    }
    const ok = await verifyPassword(currentPassword, identity.passwordHash);
    if (!ok) {
      throw new AppError("INVALID_CREDENTIALS", "Current password is incorrect.", 401);
    }
    await this.prisma.authIdentity.update({
      where: { id: identity.id },
      data: { passwordHash: await hashPassword(newPassword) },
    });
    return { ok: true };
  }

  async updateProfile(userId: string, displayName: string): Promise<MeResponse> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { displayName },
      include: { identities: true },
    });
    return toMeResponse(user);
  }

  async deleteAccount(userId: string, password?: string): Promise<{ ok: true }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { identities: true },
    });
    if (!user) {
      throw new AppError("UNAUTHENTICATED", "Authentication required.", 401);
    }
    const emailIdentity = user.identities.find((identity) => identity.provider === "EMAIL");
    if (emailIdentity?.passwordHash) {
      if (!password) {
        throw new AppError("PASSWORD_REQUIRED", "Password confirmation is required.", 400);
      }
      const ok = await verifyPassword(password, emailIdentity.passwordHash);
      if (!ok) {
        throw new AppError("INVALID_CREDENTIALS", "Password is incorrect.", 401);
      }
    }

    await this.prisma.authToken.deleteMany({ where: { userId } });
    await this.games.deleteAllForUser(userId);
    await this.prisma.authIdentity.deleteMany({ where: { userId } });
    await this.detachAllSessions(userId);
    await this.prisma.user.delete({ where: { id: userId } });
    return { ok: true };
  }

  async claimAnonymousSession(sessionId: string, userId: string): Promise<void> {
    await this.identitySessions.attachUser(sessionId, userId);

    const redis = await this.redisSessions.get(sessionId);
    if (redis) {
      await this.redisSessions.set(sessionId, { ...redis, userId });
    }

    const unclaimed = await this.games.listOfficialUnclaimedBySession(sessionId);
    for (const result of unclaimed) {
      const existing = await this.games.findOfficialForUserPuzzle(userId, result.puzzleId);
      if (existing) {
        await this.games.discardOfficial(result.id);
        continue;
      }
      try {
        await this.games.claimForUser(result.id, userId);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          await this.games.discardOfficial(result.id);
          continue;
        }
        throw error;
      }
    }
  }

  private async detachAllSessions(userId: string): Promise<void> {
    const sessions = await this.identitySessions.clearUserForAccount(userId);
    for (const session of sessions) {
      const redis = await this.redisSessions.get(session.id);
      if (redis) {
        await this.redisSessions.set(session.id, { ...redis, userId: null });
      }
    }
  }

  private async issueToken(
    userId: string,
    type: AuthTokenType,
    ttlMs: number,
    email: string,
  ): Promise<void> {
    await this.prisma.authToken.updateMany({
      where: { userId, type, usedAt: null },
      data: { usedAt: new Date() },
    });
    const raw = createAuthToken();
    await this.prisma.authToken.create({
      data: {
        userId,
        type,
        tokenHash: hashAuthToken(raw),
        expiresAt: new Date(Date.now() + ttlMs),
      },
    });
    const origin = this.frontendOrigin.replace(/\/$/, "");
    if (type === "VERIFY_EMAIL") {
      await this.mailer.send({
        to: email,
        subject: "Verify your Wikognito email",
        text: `Verify your email: ${origin}/verify-email?token=${raw}`,
      });
      return;
    }
    await this.mailer.send({
      to: email,
      subject: "Reset your Wikognito password",
      text: `Reset your password: ${origin}/reset-password?token=${raw}`,
    });
  }

  private async consumeToken(rawToken: string, type: AuthTokenType) {
    const token = await this.prisma.authToken.findUnique({
      where: { tokenHash: hashAuthToken(rawToken) },
    });
    if (!token || token.type !== type || token.usedAt || token.expiresAt.getTime() <= Date.now()) {
      throw new AppError("INVALID_TOKEN", "This link is invalid or has expired.", 400);
    }
    return this.prisma.authToken.update({
      where: { id: token.id },
      data: { usedAt: new Date() },
    });
  }

  private async findOrCreateGoogleUser(profile: GoogleProfile): Promise<User> {
    const role = roleForEmail(profile.email, this.adminEmails);
    const verifiedAt = profile.email ? new Date() : null;
    const existing = await this.prisma.authIdentity.findUnique({
      where: {
        provider_providerSubject: {
          provider: "GOOGLE",
          providerSubject: profile.providerSubject,
        },
      },
    });

    if (existing) {
      return this.prisma.user.update({
        where: { id: existing.userId },
        data: {
          email: profile.email,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
          role,
          emailVerifiedAt: verifiedAt,
        },
      });
    }

    try {
      return await this.prisma.user.create({
        data: {
          role,
          email: profile.email,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
          emailVerifiedAt: verifiedAt,
          identities: {
            create: {
              provider: "GOOGLE",
              providerSubject: profile.providerSubject,
            },
          },
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const raced = await this.prisma.authIdentity.findUnique({
          where: {
            provider_providerSubject: {
              provider: "GOOGLE",
              providerSubject: profile.providerSubject,
            },
          },
        });
        if (!raced) {
          throw new AppError("AUTH_IDENTITY_CONFLICT", "Could not create user identity.", 409);
        }
        return this.prisma.user.update({
          where: { id: raced.userId },
          data: {
            email: profile.email,
            displayName: profile.displayName,
            avatarUrl: profile.avatarUrl,
            role,
            emailVerifiedAt: verifiedAt,
          },
        });
      }
      throw error;
    }
  }
}
