"use server";

import { revalidatePath } from "next/cache";
import { AUDIT_ACTIONS } from "@/features/audit/constants/audit-actions";
import { validateAuditReason } from "@/features/audit/lib/validate-audit-input";
import { markAttendance } from "@/features/attendance/services/mark-attendance";
import { reverseAttendance } from "@/features/attendance/services/reverse-attendance";
import { requireAdmin } from "@/features/auth/server/auth";
import { AuthError } from "@/features/auth/types/auth";

export type AttendanceActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
};

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function markAttendanceAction(
  _state: AttendanceActionState,
  formData: FormData,
): Promise<AttendanceActionState> {
  const result = await markAttendance({
    qrRegistrationId: text(formData, "qrRegistrationId"),
  });
  if (!result.ok) return { status: "error", message: result.message };
  revalidatePath("/dashboard/attendance");
  return {
    status: "success",
    message: "Öğrenci etkinliğe katıldı olarak işaretlendi.",
  };
}

export async function reverseAttendanceAction(
  _state: AttendanceActionState,
  formData: FormData,
): Promise<AttendanceActionState> {
  let reason: string;
  try {
    reason = validateAuditReason(
      AUDIT_ACTIONS.ATTENDANCE_REVERSED,
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

  const result = await reverseAttendance({
    qrRegistrationId: text(formData, "qrRegistrationId"),
    reason,
  });
  if (!result.ok) return { status: "error", message: result.message };

  revalidatePath("/dashboard/attendance");
  return { status: "success", message: "Katılım işareti geri alındı." };
}
