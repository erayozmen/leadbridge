import { describe, expect, it } from "vitest";
import { getBackupConfigurationState, LOGICAL_BACKUP_SCRIPT, RECOVERY_RUNBOOK } from "./backup";

describe("backup configuration detection", () => {
  it("detects logical tooling and recovery documentation independently", () => {
    const state = getBackupConfigurationState((path) => path.endsWith(LOGICAL_BACKUP_SCRIPT.replaceAll("/", "\\")) || path.endsWith(LOGICAL_BACKUP_SCRIPT), "C:/repo");
    expect(state).toEqual({ logicalToolingAvailable: true, recoveryDocumentationAvailable: false, policyConfigured: false });
  });
  it("reports the policy only when the recovery runbook exists", () => {
    const state = getBackupConfigurationState((path) => path.endsWith(RECOVERY_RUNBOOK.replaceAll("/", "\\")) || path.endsWith(RECOVERY_RUNBOOK), "C:/repo");
    expect(state).toEqual({ logicalToolingAvailable: false, recoveryDocumentationAvailable: true, policyConfigured: true });
  });
});
