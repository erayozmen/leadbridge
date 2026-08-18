import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ findFirst: vi.fn(), count: vi.fn(), findMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { academySyncRun: mocks } }));
import { getAcademySyncMonitoring } from "./monitoring";
describe("sync monitoring query", () => {
  it("returns the persisted summary and requests newest history first", async () => {
    const latest = { id: "latest", status: "PARTIAL", candidateCount: 8, matchedCount: 4, notFoundCount: 2, ambiguousCount: 1, commissionAdjustmentCount: 3, errorCount: 1 };
    mocks.findFirst.mockResolvedValue(latest); mocks.count.mockResolvedValue(12); mocks.findMany.mockResolvedValue([{ id: "new" }, { id: "old" }]);
    const result = await getAcademySyncMonitoring(1);
    expect(result.latest).toEqual(latest); expect(result.pageCount).toBe(2);
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { startedAt: "desc" }, take: 10 }));
    expect(result.history.map((run) => run.id)).toEqual(["new", "old"]);
  });
});
