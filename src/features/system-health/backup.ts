import { existsSync } from "node:fs";
import { resolve } from "node:path";

export const LOGICAL_BACKUP_SCRIPT = "scripts/backup-production.ts";
export const RECOVERY_RUNBOOK = "docs/production-backup-recovery.md";

export function getBackupConfigurationState(fileExists: (path: string) => boolean = existsSync, cwd = process.cwd()) {
  const logicalToolingAvailable = fileExists(resolve(cwd, LOGICAL_BACKUP_SCRIPT));
  const recoveryDocumentationAvailable = fileExists(resolve(cwd, RECOVERY_RUNBOOK));
  return { logicalToolingAvailable, recoveryDocumentationAvailable, policyConfigured: recoveryDocumentationAvailable };
}
