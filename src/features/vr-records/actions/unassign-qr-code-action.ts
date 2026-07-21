"use server";

import { revalidatePath } from "next/cache";
import { AUDIT_ACTIONS } from "@/features/audit/constants/audit-actions";
import { validateAuditReason } from "@/features/audit/lib/validate-audit-input";
import { requireAdmin } from "@/features/auth/server/auth";
import { AuthError } from "@/features/auth/types/auth";
import { unassignQrCode } from "@/features/vr-records/services/unassign-qr-code";

export type UnassignQrCodeActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
};

function text(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function unassignQrCodeAction(
  _state: UnassignQrCodeActionState,
  formData: FormData,
): Promise<UnassignQrCodeActionState> {
  let reason: string;
  try {
    reason = validateAuditReason(
      AUDIT_ACTIONS.QR_ASSIGNMENT_REVERSED,
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

  const result = await unassignQrCode({
    vrRecordId: text(formData, "vrRecordId"),
    qrCodeId: text(formData, "qrCodeId"),
    reason,
  });
  if (!result.ok) return { status: "error", message: result.message };

  revalidatePath("/dashboard/vr-records");
  revalidatePath("/dashboard/qr-codes");
  return {
    status: "success",
    message: `${result.serialNumber} numaralı QR kartının ataması geri alındı.`,
  };
}
