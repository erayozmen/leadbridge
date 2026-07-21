"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/features/auth/server/auth";
import { assignQrCode } from "@/features/vr-records/services/assign-qr-code";

export type AssignQrCodeActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
};

export async function assignQrCodeAction(
  _state: AssignQrCodeActionState,
  formData: FormData,
): Promise<AssignQrCodeActionState> {
  try {
    await requireAdmin();
  } catch {
    return {
      status: "error",
      message: "Bu işlem yalnızca yöneticiler tarafından yapılabilir.",
    };
  }

  const vrRecordId = formData.get("vrRecordId");
  const qrCodeId = formData.get("qrCodeId");
  const result = await assignQrCode({
    vrRecordId: typeof vrRecordId === "string" ? vrRecordId : "",
    qrCodeId: typeof qrCodeId === "string" ? qrCodeId : "",
  });

  if (!result.ok) return { status: "error", message: result.message };

  revalidatePath("/dashboard/vr-records");
  revalidatePath("/dashboard/qr-codes");
  return { status: "success", message: `${result.serialNumber} numaralı QR kartı başarıyla atandı.` };
}
