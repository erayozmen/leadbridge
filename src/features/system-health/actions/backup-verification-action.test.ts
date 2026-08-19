import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ requireAdmin: vi.fn(), transaction: vi.fn(), create: vi.fn(), audit: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/features/auth/server/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock("@/features/audit/services/write-audit-log", () => ({ writeAuditLog: mocks.audit }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { recordBackupVerificationAction } from "./backup-verification-action";
function form() { const data = new FormData(); data.set("managedStatus", "ACTIVE"); data.set("pitrStatus", "DISABLED"); data.set("restoreStatus", "NOT_RECORDED"); data.set("lastBackupAt", "2026-08-19T10:00"); return data; }
describe("backup verification action", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.requireAdmin.mockResolvedValue({ id: "admin-1" }); mocks.create.mockResolvedValue({ id: "verification-1" }); mocks.transaction.mockImplementation(async (callback) => callback({ backupVerification: { create: mocks.create }, auditLog: { create: vi.fn() } })); mocks.audit.mockResolvedValue({ id: "audit-1", createdAt: new Date() }); });
  it("is admin-only", async () => { mocks.requireAdmin.mockRejectedValue(new Error("forbidden")); const result = await recordBackupVerificationAction({ status: "idle", message: null }, form()); expect(result.status).toBe("error"); expect(mocks.transaction).not.toHaveBeenCalled(); });
  it("writes safe metadata and an audit record", async () => { const result = await recordBackupVerificationAction({ status: "idle", message: null }, form()); expect(result.status).toBe("success"); expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ managedStatus: "ACTIVE", pitrStatus: "DISABLED", verifiedByUserId: "admin-1" }) })); expect(mocks.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "BACKUP_VERIFICATION_RECORDED", actor: { type: "USER", userId: "admin-1" } })); expect(JSON.stringify(mocks.audit.mock.calls)).not.toMatch(/DATABASE_URL|password|secret/i); });
});
