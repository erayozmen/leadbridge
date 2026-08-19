"use server";
import { AcademySyncRunSource } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/features/auth/server/auth";
import { runAcademyCommissionSync } from "@/features/academy-commissions/sync";
import { captureTechnicalException } from "@/lib/monitoring/capture";
export type ManualSyncState = { status: "idle" | "success" | "error"; message: string | null };
export async function runAcademyManualSyncAction(_state: ManualSyncState): Promise<ManualSyncState> {
  void _state;
  try { await requireAdmin(); } catch { return { status: "error", message: "Bu işlem yalnızca yöneticiler tarafından başlatılabilir." }; }
  try {
    const result = await runAcademyCommissionSync(AcademySyncRunSource.MANUAL);
    revalidatePath("/dashboard/commissions");
    return result.skipped ? { status: "success", message: "Bir senkronizasyon zaten çalışıyor; yeni çalışma başlatılmadı." } : { status: "success", message: "Academy senkronizasyonu tamamlandı." };
  } catch (error) { captureTechnicalException(error, { feature: "academy-commission-sync", operation: "manual-action", source: "MANUAL", runStatus: "FAILED" }); return { status: "error", message: "Academy senkronizasyonu tamamlanamadı." }; }
}
