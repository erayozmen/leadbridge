import { AcademySyncRunSource } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ requireAdmin: vi.fn(), runSync: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/features/auth/server/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/features/academy-commissions/sync", () => ({ runAcademyCommissionSync: mocks.runSync }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
import { runAcademyManualSyncAction } from "./manual-sync-action";
describe("manual Academy sync", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.requireAdmin.mockResolvedValue({ id: "admin" }); mocks.runSync.mockResolvedValue({ skipped: false }); });
  it("requires admin authorization", async () => { mocks.requireAdmin.mockRejectedValue(new Error("forbidden")); expect((await runAcademyManualSyncAction({ status: "idle", message: null })).status).toBe("error"); expect(mocks.runSync).not.toHaveBeenCalled(); });
  it("uses MANUAL source and refreshes the page", async () => { expect((await runAcademyManualSyncAction({ status: "idle", message: null })).status).toBe("success"); expect(mocks.runSync).toHaveBeenCalledWith(AcademySyncRunSource.MANUAL); expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/commissions"); });
  it("reports concurrent sync without starting duplicate work", async () => { mocks.runSync.mockResolvedValue({ skipped: true }); const result = await runAcademyManualSyncAction({ status: "idle", message: null }); expect(result.message).toContain("zaten çalışıyor"); expect(mocks.revalidatePath).toHaveBeenCalled(); });
  it("does not expose CRON_SECRET through the action", async () => { await runAcademyManualSyncAction({ status: "idle", message: null }); expect(JSON.stringify(mocks.runSync.mock.calls)).not.toContain("CRON_SECRET"); });
});
