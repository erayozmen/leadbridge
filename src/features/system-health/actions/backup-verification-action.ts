"use server";
import { BackupVerificationStatus, BackupVerificationType, ManagedBackupStatus, PitrStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AUDIT_ACTIONS } from "@/features/audit/constants/audit-actions";
import { AUDIT_ENTITY_TYPES } from "@/features/audit/constants/audit-entity-types";
import { writeAuditLog } from "@/features/audit/services/write-audit-log";
import { requireAdmin } from "@/features/auth/server/auth";
import { prisma } from "@/lib/prisma";
import { backupManifestSchema } from "../backup";

export type BackupVerificationActionState = { status: "idle" | "success" | "error"; message: string | null };
const schema = z.object({ managedStatus: z.enum(ManagedBackupStatus), pitrStatus: z.enum(PitrStatus), restoreStatus: z.enum(["NOT_RECORDED", "VERIFIED", "FAILED"]), lastBackupAt: z.string().max(40).optional(), manifest: z.string().max(4_000).optional() });
export async function recordBackupVerificationAction(_state: BackupVerificationActionState, formData: FormData): Promise<BackupVerificationActionState> {
  let admin; try { admin = await requireAdmin(); } catch { return { status: "error", message: "Bu işlem yalnızca yöneticiler tarafından yapılabilir." }; }
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Doğrulama alanlarını kontrol edin." };
  const backupCreatedAt = parsed.data.lastBackupAt ? new Date(parsed.data.lastBackupAt) : null;
  if (backupCreatedAt && Number.isNaN(backupCreatedAt.getTime())) return { status: "error", message: "Backup tarihi geçerli değil." };
  let manifest: z.infer<typeof backupManifestSchema> | null = null;
  if (parsed.data.manifest?.trim()) { try { manifest = backupManifestSchema.parse(JSON.parse(parsed.data.manifest)); } catch { return { status: "error", message: "Logical backup manifest geçerli değil." }; } }
  await prisma.$transaction(async (tx) => {
    const managed = await tx.backupVerification.create({ data: { type: BackupVerificationType.MANAGED_BACKUP, status: BackupVerificationStatus.VERIFIED, provider: "SUPABASE", verificationMethod: "SUPABASE_DASHBOARD", managedStatus: parsed.data.managedStatus, pitrStatus: parsed.data.pitrStatus, backupCreatedAt, verifiedByUserId: admin.id } });
    if (manifest) await tx.backupVerification.create({ data: { type: BackupVerificationType.LOGICAL_BACKUP, status: BackupVerificationStatus.VERIFIED, provider: "POSTGRESQL", verificationMethod: manifest.verificationMethod, backupCreatedAt: new Date(manifest.backupCreatedAt), sizeBytes: BigInt(manifest.sizeBytes), checksumSha256: manifest.checksumSha256, pgDumpVersion: manifest.pgDumpVersion, verifiedByUserId: admin.id } });
    if (parsed.data.restoreStatus !== "NOT_RECORDED") await tx.backupVerification.create({ data: { type: BackupVerificationType.RESTORE_REHEARSAL, status: parsed.data.restoreStatus, provider: "POSTGRESQL", verificationMethod: "ISOLATED_RESTORE_REHEARSAL", verifiedByUserId: admin.id } });
    await writeAuditLog(tx, { actor: { type: "USER", userId: admin.id }, action: AUDIT_ACTIONS.BACKUP_VERIFICATION_RECORDED, entityType: AUDIT_ENTITY_TYPES.BACKUP_VERIFICATION, entityId: managed.id, afterData: { managedStatus: parsed.data.managedStatus, pitrStatus: parsed.data.pitrStatus, backupCreatedAt: backupCreatedAt?.toISOString() ?? null, logicalManifestRecorded: Boolean(manifest), restoreStatus: parsed.data.restoreStatus } });
  });
  revalidatePath("/dashboard/system-health");
  return { status: "success", message: manifest ? "Managed ve logical backup doğrulaması kaydedildi." : "Managed backup doğrulaması kaydedildi." };
}
