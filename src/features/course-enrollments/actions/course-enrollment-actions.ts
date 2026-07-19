"use server";
import { revalidatePath } from "next/cache";
import { markCourseEnrollment } from "@/features/course-enrollments/services/mark-course-enrollment";
import { requireAdmin } from "@/features/auth/server/auth";
export type CourseEnrollmentActionState = { status: "idle" | "success" | "error"; message: string | null };
export async function markCourseEnrollmentAction(_state: CourseEnrollmentActionState, formData: FormData): Promise<CourseEnrollmentActionState> {
  void _state; try { await requireAdmin(); } catch { return { status: "error", message: "Bu işlem yalnızca yöneticiler tarafından yapılabilir." }; } const value = formData.get("qrRegistrationId"); const result = await markCourseEnrollment({ qrRegistrationId: typeof value === "string" ? value : "" });
  if (!result.ok) return { status: "error", message: result.message };
  revalidatePath("/dashboard/course-enrollments"); return { status: "success", message: "Öğrenci dil kursuna kayıtlı olarak işaretlendi." };
}
