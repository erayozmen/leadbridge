import { z } from "zod";
import type { HealthStatus } from "./domain";

export const LOGICAL_BACKUP_SCRIPT = "scripts/backup-production.ts";
export const RECOVERY_RUNBOOK = "docs/production-backup-recovery.md";
export const RECOVERY_RUNBOOK_AVAILABLE = true;
export const BACKUP_HEALTH_POLICY = { managedVerificationMaxAgeDays: 7, logicalBackupMaxAgeDays: 7, restoreRehearsalMaxAgeDays: 90 } as const;

export const backupManifestSchema = z.object({ manifestVersion: z.literal(1), backupCreatedAt: z.iso.datetime(), sizeBytes: z.number().int().positive(), checksumSha256: z.string().regex(/^[a-f0-9]{64}$/), pgDumpVersion: z.string().min(1).max(120), verificationStatus: z.literal("VERIFIED"), verificationMethod: z.literal("pg_restore --list") });
export type BackupManifest = z.infer<typeof backupManifestSchema>;
export function parseBackupManifest(value: unknown) { return backupManifestSchema.parse(value); }

type Verification = { status: "VERIFIED" | "FAILED"; verifiedAt: Date; backupCreatedAt?: Date | null } | null;
function ageDays(date: Date, now: Date) { return Math.max(0, now.getTime() - date.getTime()) / 86_400_000; }
export function deriveBackupOperationsHealth(input: { now: Date; managed: (NonNullable<Verification> & { managedStatus?: "ACTIVE" | "INACTIVE" | "UNKNOWN" | null }) | null; logical: Verification; restore: Verification; runbookAvailable: boolean }): HealthStatus {
  if (!input.runbookAvailable) return "DEGRADED";
  if (!input.managed && !input.logical) return "UNKNOWN";
  if (input.managed?.status === "FAILED" || input.logical?.status === "FAILED") return "FAILED";
  if (input.managed?.managedStatus === "INACTIVE" && (!input.logical || input.logical.status !== "VERIFIED" || ageDays(input.logical.backupCreatedAt ?? input.logical.verifiedAt, input.now) > BACKUP_HEALTH_POLICY.logicalBackupMaxAgeDays)) return "FAILED";
  if (!input.managed || input.managed.managedStatus !== "ACTIVE" || ageDays(input.managed.verifiedAt, input.now) > BACKUP_HEALTH_POLICY.managedVerificationMaxAgeDays) return "DEGRADED";
  if (!input.logical) return "DEGRADED";
  if (ageDays(input.logical.backupCreatedAt ?? input.logical.verifiedAt, input.now) > BACKUP_HEALTH_POLICY.logicalBackupMaxAgeDays) return "WARNING";
  if (!input.restore || input.restore.status !== "VERIFIED" || ageDays(input.restore.verifiedAt, input.now) > BACKUP_HEALTH_POLICY.restoreRehearsalMaxAgeDays) return "WARNING";
  return "HEALTHY";
}
export function getBackupConfigurationState() { return { logicalToolingAvailable: true, recoveryDocumentationAvailable: RECOVERY_RUNBOOK_AVAILABLE, policyConfigured: true }; }
