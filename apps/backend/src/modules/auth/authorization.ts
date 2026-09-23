import { AppError } from "../errors.js";
import type { User } from "@prisma/client";
import type { IdentitySessionWithUser } from "../identity/identity-session.repository.js";

export function requireAuthenticatedUser(session: IdentitySessionWithUser | null): User {
  if (!session?.user) {
    throw new AppError("UNAUTHENTICATED", "Authentication required.", 401);
  }
  return session.user;
}

export function requireAdmin(session: IdentitySessionWithUser | null): User {
  const user = requireAuthenticatedUser(session);
  if (user.role !== "ADMIN") {
    throw new AppError("FORBIDDEN", "Admin access required.", 403);
  }
  return user;
}
