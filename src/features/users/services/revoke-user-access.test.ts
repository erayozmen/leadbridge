import { UserRole, UserStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { revokeUserAccess, type RevokeUserDependencies } from "@/features/users/services/revoke-user-access";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }));

const target = { id: "user_2", authUserId: "auth_2", role: UserRole.STAFF, status: UserStatus.ACTIVE };
function dependencies(overrides: Partial<RevokeUserDependencies> = {}): RevokeUserDependencies {
  return {
    requireAdmin: vi.fn(async () => ({ id: "admin_1" })) as RevokeUserDependencies["requireAdmin"],
    findTarget: vi.fn(async () => target),
    countActiveAdmins: vi.fn(async () => 2),
    deleteAuthUser: vi.fn(async () => true),
    revokeAppAccess: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("revokeUserAccess", () => {
  it("removes Auth access before preserving an INACTIVE app record", async () => {
    const deps = dependencies();
    await expect(revokeUserAccess({ userId: target.id, reason: "  Kullanıcı kurumdan ayrıldı  " }, deps)).resolves.toEqual({ ok: true });
    expect(deps.deleteAuthUser).toHaveBeenCalledWith(target.authUserId);
    expect(deps.revokeAppAccess).toHaveBeenCalledWith(target, "admin_1", "Kullanıcı kurumdan ayrıldı");
  });

  it("protects self and the last active ADMIN", async () => {
    const self = dependencies();
    await expect(revokeUserAccess({ userId: "admin_1", reason: "Kullanıcı erişimi kaldırılıyor" }, self)).resolves.toMatchObject({ code: "SELF_DELETE" });
    const lastAdmin = dependencies({ findTarget: vi.fn(async () => ({ ...target, role: UserRole.ADMIN })), countActiveAdmins: vi.fn(async () => 1) });
    await expect(revokeUserAccess({ userId: target.id, reason: "Kullanıcı erişimi kaldırılıyor" }, lastAdmin)).resolves.toMatchObject({ code: "LAST_ACTIVE_ADMIN" });
    expect(lastAdmin.deleteAuthUser).not.toHaveBeenCalled();
  });

  it("does not mutate Prisma when Auth revocation fails", async () => {
    const deps = dependencies({ deleteAuthUser: vi.fn(async () => false) });
    await expect(revokeUserAccess({ userId: target.id, reason: "Kullanıcı erişimi kaldırılıyor" }, deps)).resolves.toMatchObject({ code: "AUTH_REVOKE_FAILED" });
    expect(deps.revokeAppAccess).not.toHaveBeenCalled();
  });

  it("rejects invalid reason, missing user, and STAFF", async () => {
    const deps = dependencies();
    await expect(revokeUserAccess({ userId: target.id, reason: "kısa" }, deps)).resolves.toMatchObject({ code: "INVALID_REASON" });
    await expect(revokeUserAccess({ userId: target.id, reason: "Kullanıcı erişimi kaldırılıyor" }, dependencies({ findTarget: vi.fn(async () => null) }))).resolves.toMatchObject({ code: "NOT_FOUND" });
    await expect(revokeUserAccess({ userId: target.id, reason: "Kullanıcı erişimi kaldırılıyor" }, dependencies({ requireAdmin: vi.fn(async () => { throw new Error("forbidden"); }) as RevokeUserDependencies["requireAdmin"] }))).resolves.toMatchObject({ code: "FORBIDDEN" });
  });
});
