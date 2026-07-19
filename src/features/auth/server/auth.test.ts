import { UserRole, UserStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { getCurrentAppUser, requireActiveUser, requireAdmin, requireStaffOrAdmin } from "@/features/auth/server/auth";
import { type AppUser, type AuthDependencies, type AuthError } from "@/features/auth/types/auth";

vi.mock("server-only", () => ({}));

const admin: AppUser = { id: "user_1", authUserId: "auth_1", email: "admin@example.test", fullName: "Admin User", role: UserRole.ADMIN, status: UserStatus.ACTIVE };

function dependencies(appUser: AppUser | null): AuthDependencies {
  return { getAuthUser: vi.fn(async () => ({ id: "auth_1" })), findAppUserByAuthUserId: vi.fn(async () => appUser) };
}

async function expectAuthError(promise: Promise<unknown>, code: AuthError["code"]) {
  await expect(promise).rejects.toMatchObject({ code });
}

describe("server auth helpers", () => {
  it("returns null when there is no authenticated user", async () => {
    const deps: AuthDependencies = { getAuthUser: vi.fn(async () => null), findAppUserByAuthUserId: vi.fn(async () => admin) };
    await expect(getCurrentAppUser(deps)).resolves.toBeNull();
    expect(deps.findAppUserByAuthUserId).not.toHaveBeenCalled();
  });
  it("rejects a user without an application record", async () => {
    await expectAuthError(requireActiveUser(dependencies(null)), "USER_NOT_PROVISIONED");
  });
  it("rejects an inactive application user", async () => {
    await expectAuthError(requireActiveUser(dependencies({ ...admin, status: UserStatus.INACTIVE })), "USER_INACTIVE");
  });
  it("accepts an active ADMIN", async () => {
    await expect(requireAdmin(dependencies(admin))).resolves.toEqual(admin);
  });
  it("accepts an active STAFF", async () => {
    const staff = { ...admin, role: UserRole.STAFF };
    await expect(requireStaffOrAdmin(dependencies(staff))).resolves.toEqual(staff);
  });
  it("rejects STAFF from ADMIN-only access", async () => {
    await expectAuthError(requireAdmin(dependencies({ ...admin, role: UserRole.STAFF })), "FORBIDDEN");
  });
});
