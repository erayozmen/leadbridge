import type { UserRole, UserStatus } from "@prisma/client";

export type AuthUser = { id: string; email?: string };

export type AppUser = {
  id: string;
  authUserId: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
};

export type AuthDependencies = {
  getAuthUser: () => Promise<AuthUser | null>;
  findAppUserByAuthUserId: (authUserId: string) => Promise<AppUser | null>;
};

export type AuthFailureCode = "UNAUTHENTICATED" | "USER_NOT_PROVISIONED" | "USER_INACTIVE" | "FORBIDDEN";

export class AuthError extends Error {
  constructor(public readonly code: AuthFailureCode) {
    super(code);
    this.name = "AuthError";
  }
}
