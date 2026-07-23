import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireAdmin, provisionUser, revokeUserAccess, revalidatePath } = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  provisionUser: vi.fn(),
  revokeUserAccess: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/features/auth/server/auth", () => ({ requireAdmin }));
vi.mock("@/features/users/services/provision-user", () => ({ provisionUser }));
vi.mock("@/features/users/services/revoke-user-access", () => ({ revokeUserAccess }));
vi.mock("@/features/users/services/update-user-access", () => ({ updateUserAccess: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { createUserAction, revokeUserAccessAction } from "@/features/users/actions/user-actions";

const state = { status: "idle" as const, message: null };

describe("user provisioning actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdmin.mockResolvedValue({ id: "admin_1" });
    provisionUser.mockResolvedValue({ ok: true, user: { id: "user_1" } });
    revokeUserAccess.mockResolvedValue({ ok: true });
  });

  it("checks ADMIN and revalidates only after successful create", async () => {
    const form = new FormData();
    form.set("fullName", "Ayşe Yılmaz");
    form.set("email", "user@example.com");
    form.set("role", "STAFF");
    form.set("temporaryPassword", "Temporary-1234");
    await expect(createUserAction(state, form)).resolves.toMatchObject({ status: "success" });
    expect(requireAdmin).toHaveBeenCalledOnce();
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/users");
  });

  it("does not revalidate failed create or revoke", async () => {
    provisionUser.mockResolvedValue({ ok: false, message: "safe error" });
    const createForm = new FormData();
    createForm.set("fullName", "Ayşe Yılmaz");
    createForm.set("email", "user@example.com");
    createForm.set("role", "STAFF");
    createForm.set("temporaryPassword", "Temporary-1234");
    await createUserAction(state, createForm);
    revokeUserAccess.mockResolvedValue({ ok: false, message: "safe error" });
    const revokeForm = new FormData();
    revokeForm.set("userId", "user_1");
    revokeForm.set("reason", "Kullanıcı kurumdan ayrıldı");
    await revokeUserAccessAction(state, revokeForm);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects unauthorized callers before service invocation", async () => {
    requireAdmin.mockRejectedValue(new Error("forbidden"));
    await expect(revokeUserAccessAction(state, new FormData())).resolves.toMatchObject({ status: "error" });
    expect(revokeUserAccess).not.toHaveBeenCalled();
  });

  it("rejects short revoke reason before service invocation", async () => {
    const form = new FormData();
    form.set("userId", "user_1");
    form.set("reason", "kısa");
    await expect(revokeUserAccessAction(state, form)).resolves.toMatchObject({ status: "error" });
    expect(revokeUserAccess).not.toHaveBeenCalled();
  });
});
