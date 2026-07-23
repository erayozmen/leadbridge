"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/features/auth/server/auth";
import { assignVrRecordsToEvent, deleteVrRecords } from "@/features/vr-records/services/manage-vr-records";

export type ManageVrRecordsActionState = { status: "idle" | "success" | "error"; message: string | null };

export async function manageVrRecordsAction(_state: ManageVrRecordsActionState, data: FormData): Promise<ManageVrRecordsActionState> {
  try {
    await requireAdmin();
    const ids = data.getAll("recordIds");
    const intent = String(data.get("intent") ?? "");
    const reason = data.get("reason");
    const result = intent === "delete"
      ? await deleteVrRecords(ids, reason)
      : intent === "assign-event"
        ? await assignVrRecordsToEvent(ids, data.get("eventId"), reason)
        : { ok: false as const, message: "Geçersiz toplu işlem." };
    if (!result.ok) return { status: "error", message: result.message };
    revalidatePath("/dashboard/vr-records");
    revalidatePath("/dashboard");
    return { status: "success", message: `${result.count} kayıt güncellendi.` };
  } catch {
    return { status: "error", message: "İşlem tamamlanamadı. Neden alanını ve seçilen kayıtları kontrol edin." };
  }
}
