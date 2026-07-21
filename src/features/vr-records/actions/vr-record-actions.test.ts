import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireStaffOrAdmin, createVrRecord, revalidatePath } = vi.hoisted(() => ({
  requireStaffOrAdmin: vi.fn(),
  createVrRecord: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/features/auth/server/auth", () => ({ requireStaffOrAdmin }));
vi.mock("@/features/vr-records/services/create-vr-record", () => ({ createVrRecord }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { createVrRecordAction } from "@/features/vr-records/actions/vr-record-actions";

const initial = { status: "idle" as const, message: null };

describe("createVrRecordAction authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireStaffOrAdmin.mockResolvedValue({ id: "staff_1" });
    createVrRecord.mockResolvedValue({
      ok: true,
      record: { id: "vr_1", firstName: "Ada", lastName: "Yılmaz" },
    });
  });

  it("allows STAFF or ADMIN through the action boundary", async () => {
    await createVrRecordAction(initial, new FormData());
    expect(requireStaffOrAdmin).toHaveBeenCalledOnce();
    expect(createVrRecord).toHaveBeenCalledOnce();
  });

  it("rejects unauthorized callers before mutation", async () => {
    requireStaffOrAdmin.mockRejectedValue(new Error("forbidden"));
    const result = await createVrRecordAction(initial, new FormData());
    expect(result.status).toBe("error");
    expect(createVrRecord).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
