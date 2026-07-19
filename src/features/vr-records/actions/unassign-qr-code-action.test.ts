import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireAdmin, unassignQrCode, revalidatePath } = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  unassignQrCode: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/features/auth/server/auth", () => ({ requireAdmin }));
vi.mock("@/features/vr-records/services/unassign-qr-code", () => ({ unassignQrCode }));

import { unassignQrCodeAction } from "@/features/vr-records/actions/unassign-qr-code-action";

const initial = { status: "idle" as const, message: null };
function formData() {
  const data = new FormData();
  data.set("vrRecordId", "vr_1");
  data.set("qrCodeId", "qr_1");
  return data;
}

describe("unassignQrCodeAction", () => {
  beforeEach(() => {
    requireAdmin.mockReset();
    unassignQrCode.mockReset();
    revalidatePath.mockReset();
    requireAdmin.mockResolvedValue({ role: "ADMIN" });
    unassignQrCode.mockResolvedValue({ ok: true, serialNumber: "LB-000001" });
  });

  it("runs its own ADMIN check and passes only relation ids", async () => {
    await unassignQrCodeAction(initial, formData());
    expect(requireAdmin).toHaveBeenCalledOnce();
    expect(unassignQrCode).toHaveBeenCalledWith({ vrRecordId: "vr_1", qrCodeId: "qr_1" });
  });

  it("rejects unauthorized action calls before the service", async () => {
    requireAdmin.mockRejectedValue(new Error("forbidden"));
    await expect(unassignQrCodeAction(initial, formData())).resolves.toMatchObject({ status: "error" });
    expect(unassignQrCode).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("revalidates VR and QR lists only after success", async () => {
    await expect(unassignQrCodeAction(initial, formData())).resolves.toMatchObject({ status: "success" });
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/vr-records");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/qr-codes");
  });

  it("does not revalidate or report success after failure", async () => {
    unassignQrCode.mockResolvedValue({ ok: false, code: "QR_ALREADY_USED", message: "Kullanılmış QR." });
    await expect(unassignQrCodeAction(initial, formData())).resolves.toEqual({ status: "error", message: "Kullanılmış QR." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
