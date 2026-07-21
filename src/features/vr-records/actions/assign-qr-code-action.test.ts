import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireAdmin, assignQrCode, revalidatePath } = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  assignQrCode: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/features/auth/server/auth", () => ({ requireAdmin }));
vi.mock("@/features/vr-records/services/assign-qr-code", () => ({ assignQrCode }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { assignQrCodeAction } from "@/features/vr-records/actions/assign-qr-code-action";

const initial = { status: "idle" as const, message: null };

describe("assignQrCodeAction authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdmin.mockResolvedValue({ id: "admin_1" });
    assignQrCode.mockResolvedValue({
      ok: true,
      serialNumber: "LB-000001",
      assignedAt: new Date(),
    });
  });

  it("requires ADMIN before assigning", async () => {
    await assignQrCodeAction(initial, new FormData());
    expect(requireAdmin).toHaveBeenCalledOnce();
    expect(assignQrCode).toHaveBeenCalledOnce();
  });

  it("rejects STAFF before mutation or revalidation", async () => {
    requireAdmin.mockRejectedValue(new Error("forbidden"));
    const result = await assignQrCodeAction(initial, new FormData());
    expect(result.status).toBe("error");
    expect(assignQrCode).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
