import { describe, expect, it, vi } from "vitest";
import {
  getDashboardOverviewSummary,
  type DashboardOverviewDependencies,
} from "@/features/reports/queries/get-dashboard-overview-summary";

vi.mock("server-only", () => ({}));

function dependencies(): DashboardOverviewDependencies {
  return {
    requireAdmin: vi.fn(async () => ({})),
    countQrCodes: vi.fn(async () => 2),
    countVrRecords: vi.fn(async () => 1),
    countQrRegistrations: vi.fn()
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(5),
  };
}

describe("dashboard overview summary query", () => {
  it("requires ADMIN before reading counts", async () => {
    const state = dependencies();
    await getDashboardOverviewSummary(state);
    expect(state.requireAdmin).toHaveBeenCalledOnce();
    expect(state.countVrRecords).toHaveBeenCalledWith({});
  });

  it("does not run counts when authorization fails", async () => {
    const state = dependencies();
    vi.mocked(state.requireAdmin).mockRejectedValue(new Error("forbidden"));
    await expect(getDashboardOverviewSummary(state)).rejects.toThrow("forbidden");
    expect(state.countVrRecords).not.toHaveBeenCalled();
    expect(state.countQrCodes).not.toHaveBeenCalled();
  });

  it("counts distributed QR records by assignment history", async () => {
    const state = dependencies();
    await getDashboardOverviewSummary(state);
    expect(state.countQrCodes).toHaveBeenCalledWith({ assignedAt: { not: null } });
    expect(state.countQrCodes).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: expect.anything() }),
    );
  });

  it("uses exact registration filters and returns the five KPIs", async () => {
    const state = dependencies();
    await expect(getDashboardOverviewSummary(state)).resolves.toEqual({
      totalVrRecords: 1,
      distributedQrCodes: 2,
      totalQrRegistrations: 3,
      attendedRegistrations: 4,
      courseEnrollments: 5,
    });
    expect(state.countQrRegistrations).toHaveBeenNthCalledWith(1, {});
    expect(state.countQrRegistrations).toHaveBeenNthCalledWith(2, { attendedEvent: true });
    expect(state.countQrRegistrations).toHaveBeenNthCalledWith(3, { enrolledCourse: true });
  });
});
