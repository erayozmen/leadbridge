"use server";

import { revalidatePath } from "next/cache";
import { AUDIT_ACTIONS } from "@/features/audit/constants/audit-actions";
import { validateAuditReason } from "@/features/audit/lib/validate-audit-input";
import { requireAdmin } from "@/features/auth/server/auth";
import { AuthError } from "@/features/auth/types/auth";
import { markCourseEnrollment } from "@/features/course-enrollments/services/mark-course-enrollment";
import { reverseCourseEnrollment } from "@/features/course-enrollments/services/reverse-course-enrollment";

export type CourseEnrollmentActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
};

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function markCourseEnrollmentAction(
  _state: CourseEnrollmentActionState,
  formData: FormData,
): Promise<CourseEnrollmentActionState> {
  try {
    await requireAdmin();
  } catch {
    return {
      status: "error",
      message: "Bu işlem yalnızca yöneticiler tarafından yapılabilir.",
    };
  }

  const result = await markCourseEnrollment({
    qrRegistrationId: text(formData, "qrRegistrationId"),
  });
  if (!result.ok) return { status: "error", message: result.message };

  revalidatePath("/dashboard/course-enrollments");
  return {
    status: "success",
    message: "Öğrenci dil kursuna kayıtlı olarak işaretlendi.",
  };
}

export async function reverseCourseEnrollmentAction(
  _state: CourseEnrollmentActionState,
  formData: FormData,
): Promise<CourseEnrollmentActionState> {
  let reason: string;
  try {
    reason = validateAuditReason(
      AUDIT_ACTIONS.COURSE_ENROLLMENT_REVERSED,
      text(formData, "reason"),
    ) as string;
  } catch {
    return {
      status: "error",
      message: "İşlem nedeni 10 ile 500 karakter arasında olmalıdır.",
    };
  }

  try {
    await requireAdmin();
  } catch (error) {
    return {
      status: "error",
      message: error instanceof AuthError
        ? "Bu işlem yalnızca yöneticiler tarafından yapılabilir."
        : "Yetkilendirme doğrulanamadı.",
    };
  }

  const result = await reverseCourseEnrollment({
    qrRegistrationId: text(formData, "qrRegistrationId"),
    reason,
  });
  if (!result.ok) return { status: "error", message: result.message };

  revalidatePath("/dashboard/course-enrollments");
  return { status: "success", message: "Dil kursu kaydı geri alındı." };
}
