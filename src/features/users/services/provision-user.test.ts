import { UserRole, UserStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { provisionUser, type ProvisionUserDependencies } from "@/features/users/services/provision-user";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }));

function dependencies(overrides: Partial<ProvisionUserDependencies> = {}): ProvisionUserDependencies {
  return {
    requireAdmin: vi.fn(async () => ({ id: "admin_1" })) as ProvisionUserDependencies["requireAdmin"],
    findDuplicate: vi.fn(async () => null),
    createAuthUser: vi.fn(async () => ({ ok: true, id: "auth_1" })),
    deleteAuthUser: vi.fn(async () => true),
    createAppUser: vi.fn(async (input) => ({ id: "user_1", role: input.role, status: UserStatus.ACTIVE })),
    logCleanupFailure: vi.fn(),
    ...overrides,
  };
}

const valid = { fullName: "Ayşe Yılmaz", email: " USER@EXAMPLE.COM ", role: UserRole.STAFF, temporaryPassword: "Temporary-1234" };

describe("provisionUser", () => {
  it.each([UserRole.STAFF, UserRole.ADMIN])("allows ADMIN to provision %s", async (role) => {
    const deps = dependencies();
    await expect(provisionUser({ ...valid, role }, deps)).resolves.toMatchObject({ ok: true, user: { role, status: UserStatus.ACTIVE } });
    expect(deps.createAuthUser).toHaveBeenCalledWith({ email: "user@example.com", password: valid.temporaryPassword });
    expect(deps.createAppUser).toHaveBeenCalledWith(expect.objectContaining({ email: "user@example.com", authUserId: "auth_1", actorUserId: "admin_1" }));
  });

  it("rejects invalid input and duplicates before Auth creation", async () => {
    const deps = dependencies({ findDuplicate: vi.fn(async () => ({ id: "user_1" })) });
    await expect(provisionUser({ ...valid, email: "invalid" }, deps)).resolves.toMatchObject({ ok: false, code: "INVALID_INPUT" });
    await expect(provisionUser(valid, deps)).resolves.toMatchObject({ ok: false, code: "DUPLICATE_USER" });
    expect(deps.createAuthUser).not.toHaveBeenCalled();
  });

  it("does not create Prisma user when Auth creation fails", async () => {
    const deps = dependencies({ createAuthUser: vi.fn(async () => ({ ok: false, code: "AUTH_CREATE_FAILED" })) });
    await expect(provisionUser(valid, deps)).resolves.toMatchObject({ ok: false, code: "AUTH_CREATE_FAILED" });
    expect(deps.createAppUser).not.toHaveBeenCalled();
  });

  it("cleans up Auth user when Prisma or audit transaction fails", async () => {
    const deps = dependencies({ createAppUser: vi.fn(async () => { throw new Error("database details"); }) });
    await expect(provisionUser(valid, deps)).resolves.toMatchObject({ ok: false, code: "APP_USER_CREATE_FAILED" });
    expect(deps.deleteAuthUser).toHaveBeenCalledWith("auth_1");
  });

  it("reports cleanup-required state without exposing errors", async () => {
    const deps = dependencies({
      createAppUser: vi.fn(async () => { throw new Error("private database details"); }),
      deleteAuthUser: vi.fn(async () => false),
    });
    await expect(provisionUser(valid, deps)).resolves.toMatchObject({ ok: false, code: "AUTH_CLEANUP_REQUIRED" });
    expect(deps.logCleanupFailure).toHaveBeenCalledOnce();
  });

  it("rejects STAFF at the service boundary", async () => {
    const deps = dependencies({ requireAdmin: vi.fn(async () => { throw new Error("forbidden"); }) as ProvisionUserDependencies["requireAdmin"] });
    await expect(provisionUser(valid, deps)).resolves.toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(deps.createAuthUser).not.toHaveBeenCalled();
  });
});
