import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthError } from "@/features/auth/types/auth";
import {
  reverseCourseEnrollmentAction,
  type CourseEnrollmentActionState,
} from "@/features/course-enrollments/actions/course-enrollment-actions";

const { requireAdmin, markCourseEnrollment, reverseCourseEnrollment, revalidatePath } = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  markCourseEnrollment: vi.fn(),
  reverseCourseEnrollment: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/features/auth/server/auth", () => ({ requireAdmin }));
vi.mock("@/features/course-enrollments/services/mark-course-enrollment", () => ({ markCourseEnrollment }));
vi.mock("@/features/course-enrollments/services/reverse-course-enrollment", () => ({ reverseCourseEnrollment }));
vi.mock("next/cache", () => ({ revalidatePath }));

const initial: CourseEnrollmentActionState = { status: "idle", message: null };
function formData(reason = "Yanlış kurs kaydı işaretlendi") {
  const data = new FormData();
  data.set("qrRegistrationId", "registration_1");
  data.set("reason", reason);
  return data;
}

describe("reverseCourseEnrollmentAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdmin.mockResolvedValue({ id: "admin_1" });
    reverseCourseEnrollment.mockResolvedValue({ ok: true });
  });

  it("applies its own ADMIN check and passes trimmed reason", async () => {
    await reverseCourseEnrollmentAction(initial, formData("  Yanlış kurs kaydı işaretlendi  "));
    expect(requireAdmin).toHaveBeenCalledOnce();
    expect(reverseCourseEnrollment).toHaveBeenCalledWith({
      qrRegistrationId: "registration_1",
      reason: "Yanlış kurs kaydı işaretlendi",
    });
  });

  it("rejects blank or short reason before authorization", async () => {
    for (const reason of ["   ", "çok kısa"]) {
      const result = await reverseCourseEnrollmentAction(initial, formData(reason));
      expect(result.status).toBe("error");
    }
    expect(requireAdmin).not.toHaveBeenCalled();
    expect(reverseCourseEnrollment).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects STAFF before service access", async () => {
    requireAdmin.mockRejectedValue(new AuthError("FORBIDDEN"));
    const result = await reverseCourseEnrollmentAction(initial, formData());
    expect(result.status).toBe("error");
    expect(reverseCourseEnrollment).not.toHaveBeenCalled();
  });

  it("revalidates the course route only after success", async () => {
    await reverseCourseEnrollmentAction(initial, formData());
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/course-enrollments");
  });

  it("does not revalidate or show success after failure", async () => {
    reverseCourseEnrollment.mockResolvedValue({
      ok: false,
      code: "ENROLLMENT_REVERSAL_FAILED",
      message: "Kurs kaydı geri alınamadı.",
    });
    const result = await reverseCourseEnrollmentAction(initial, formData());
    expect(result).toEqual({ status: "error", message: "Kurs kaydı geri alınamadı." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
