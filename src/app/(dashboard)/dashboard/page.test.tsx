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

describe("single-event dashboard startup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDashboardOverviewSummary.mockResolvedValue({
      totalVrRecords: 0,
      distributedQrCodes: 0,
      totalQrRegistrations: 0,
      attendedRegistrations: 0,
      courseEnrollments: 0,
    });
  });

  it("opens the ADMIN dashboard without an event cookie", async () => {
    requireActiveUser.mockResolvedValue({ role: "ADMIN", fullName: "Admin" });
    await expect(DashboardPage()).resolves.toBeTruthy();
    expect(getDashboardOverviewSummary).toHaveBeenCalledOnce();
  });

  it("opens the STAFF dashboard without an event cookie", async () => {
    requireActiveUser.mockResolvedValue({ role: "STAFF", fullName: "Staff" });
    await expect(DashboardPage()).resolves.toBeTruthy();
    expect(getDashboardOverviewSummary).not.toHaveBeenCalled();
  });
});
