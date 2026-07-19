import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireActiveUser, getDashboardOverviewSummary } = vi.hoisted(() => ({
  requireActiveUser: vi.fn(),
  getDashboardOverviewSummary: vi.fn(),
}));

vi.mock("@/features/auth/server/auth", () => ({ requireActiveUser }));
vi.mock("@/features/reports/queries/get-dashboard-overview-summary", () => ({
  getDashboardOverviewSummary,
}));

import DashboardPage from "@/app/(dashboard)/dashboard/page";

describe("dashboard overview access model", () => {
  beforeEach(() => {
    requireActiveUser.mockReset();
    getDashboardOverviewSummary.mockReset();
    getDashboardOverviewSummary.mockResolvedValue({
      totalVrRecords: 0,
      distributedQrCodes: 0,
      totalQrRegistrations: 0,
      attendedRegistrations: 0,
      courseEnrollments: 0,
    });
  });

  it("loads the ADMIN overview query for ADMIN", async () => {
    requireActiveUser.mockResolvedValue({ role: "ADMIN", fullName: "Admin" });
    await DashboardPage();
    expect(getDashboardOverviewSummary).toHaveBeenCalledOnce();
  });

  it("keeps STAFF on the operational dashboard without report counts", async () => {
    requireActiveUser.mockResolvedValue({ role: "STAFF", fullName: "Staff" });
    await DashboardPage();
    expect(getDashboardOverviewSummary).not.toHaveBeenCalled();
  });
});
