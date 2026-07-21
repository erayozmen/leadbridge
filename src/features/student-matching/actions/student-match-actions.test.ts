import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireAdmin, deleteStudentMatch, revalidatePath } = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  deleteStudentMatch: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/features/auth/server/auth", () => ({ requireAdmin }));
vi.mock("@/features/student-matching/services/delete-student-match", () => ({ deleteStudentMatch }));
vi.mock("@/features/student-matching/services/create-student-match", () => ({ createStudentMatch: vi.fn() }));

import { deleteStudentMatchAction } from "@/features/student-matching/actions/student-match-actions";

const initial = { status: "idle" as const, message: null };
function formData() {
  const data = new FormData();
  data.set("matchId", "match_1");
  data.set("vrRecordId", "vr_1");
  data.set("reason", "Yanlış öğrenciler eşleştirildi");
  return data;
}

describe("deleteStudentMatchAction", () => {
  beforeEach(() => {
    requireAdmin.mockReset();
    deleteStudentMatch.mockReset();
    revalidatePath.mockReset();
    requireAdmin.mockResolvedValue({ role: "ADMIN" });
    deleteStudentMatch.mockResolvedValue({ ok: true, message: "Eşleşme kaldırıldı." });
  });

  it("applies its own ADMIN check and passes both relation keys to the service", async () => {
    await deleteStudentMatchAction(initial, formData());
    expect(requireAdmin).toHaveBeenCalledOnce();
    expect(deleteStudentMatch).toHaveBeenCalledWith({
      matchId: "match_1",
      vrRecordId: "vr_1",
      reason: "Yanlış öğrenciler eşleştirildi",
    });
  });

  it("rejects invalid reason before authorization or service access", async () => {
    const data = formData();
    data.set("reason", "kısa");
    const result = await deleteStudentMatchAction(initial, data);
    expect(result.status).toBe("error");
    expect(requireAdmin).not.toHaveBeenCalled();
    expect(deleteStudentMatch).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects unauthorized requests before the service", async () => {
    requireAdmin.mockRejectedValue(new Error("forbidden"));
    const result = await deleteStudentMatchAction(initial, formData());
    expect(result.status).toBe("error");
    expect(deleteStudentMatch).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("revalidates both affected lists after success", async () => {
    await expect(deleteStudentMatchAction(initial, formData())).resolves.toMatchObject({ status: "success" });
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/vr-records");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/qr-registrations");
  });

  it("does not revalidate or report success when the service fails", async () => {
    deleteStudentMatch.mockResolvedValue({ ok: false, code: "MATCH_NOT_FOUND", message: "Eşleşme bulunamadı." });
    const result = await deleteStudentMatchAction(initial, formData());
    expect(result).toEqual({ status: "error", message: "Eşleşme bulunamadı." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
