import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthError } from "@/features/auth/types/auth";
import {
  reverseAttendanceAction,
  type AttendanceActionState,
} from "@/features/attendance/actions/attendance-actions";

const { requireAdmin, markAttendance, reverseAttendance, revalidatePath } = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  markAttendance: vi.fn(),
  reverseAttendance: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/features/auth/server/auth", () => ({ requireAdmin }));
vi.mock("@/features/attendance/services/mark-attendance", () => ({ markAttendance }));
vi.mock("@/features/attendance/services/reverse-attendance", () => ({ reverseAttendance }));
vi.mock("next/cache", () => ({ revalidatePath }));

const initial: AttendanceActionState = { status: "idle", message: null };
function formData(reason = "Yanlış katılım işaretlendi") {
  const data = new FormData();
  data.set("qrRegistrationId", "registration_1");
  data.set("reason", reason);
  return data;
}

describe("reverseAttendanceAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdmin.mockResolvedValue({ id: "admin_1" });
    reverseAttendance.mockResolvedValue({ ok: true });
  });

  it("applies its own ADMIN check and passes trimmed reason", async () => {
    await reverseAttendanceAction(initial, formData("  Yanlış katılım işaretlendi  "));
    expect(requireAdmin).toHaveBeenCalledOnce();
    expect(reverseAttendance).toHaveBeenCalledWith({
      qrRegistrationId: "registration_1",
      reason: "Yanlış katılım işaretlendi",
    });
  });

  it("rejects blank or short reason before authorization", async () => {
    for (const reason of ["   ", "çok kısa"]) {
      const result = await reverseAttendanceAction(initial, formData(reason));
      expect(result.status).toBe("error");
    }
    expect(requireAdmin).not.toHaveBeenCalled();
    expect(reverseAttendance).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects STAFF before service access", async () => {
    requireAdmin.mockRejectedValue(new AuthError("FORBIDDEN"));
    const result = await reverseAttendanceAction(initial, formData());
    expect(result.status).toBe("error");
    expect(reverseAttendance).not.toHaveBeenCalled();
  });

  it("revalidates attendance only after success", async () => {
    await reverseAttendanceAction(initial, formData());
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/attendance");
  });

  it("does not revalidate or show success for service failure", async () => {
    reverseAttendance.mockResolvedValue({
      ok: false,
      code: "ATTENDANCE_REVERSAL_FAILED",
      message: "Katılım geri alınamadı.",
    });
    const result = await reverseAttendanceAction(initial, formData());
    expect(result).toEqual({ status: "error", message: "Katılım geri alınamadı." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
