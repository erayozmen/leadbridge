import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireActiveUser, getDashboardOverviewSummary, getSelectedEvent, redirect } = vi.hoisted(() => ({
  requireActiveUser: vi.fn(),
  getDashboardOverviewSummary: vi.fn(),
  getSelectedEvent: vi.fn(),
  redirect: vi.fn(() => { throw new Error("NEXT_REDIRECT"); }),
}));

vi.mock("@/features/auth/server/auth", () => ({ requireActiveUser }));
vi.mock("@/features/events/server/event-context", () => ({ getSelectedEvent }));
vi.mock("@/features/reports/queries/get-dashboard-overview-summary", () => ({
  getDashboardOverviewSummary,
}));
vi.mock("next/navigation", () => ({ redirect }));

import DashboardPage from "@/app/(dashboard)/dashboard/page";

describe("dashboard overview access model", () => {
  beforeEach(() => {
    requireActiveUser.mockReset();
    getDashboardOverviewSummary.mockReset();
    getSelectedEvent.mockReset();
    redirect.mockClear();
    getSelectedEvent.mockResolvedValue({ id: "event_1", status: "ACTIVE" });
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

  it.each(["ADMIN", "STAFF"])(
    "redirects %s safely when no event can be selected",
    async (role) => {
      requireActiveUser.mockResolvedValue({ role, fullName: role });
      getSelectedEvent.mockResolvedValue(null);

      await expect(DashboardPage()).rejects.toThrow("NEXT_REDIRECT");

      expect(redirect).toHaveBeenCalledWith("/select-event");
      expect(getDashboardOverviewSummary).not.toHaveBeenCalled();
    },
  );

  it("treats an invalid event cookie as a missing selection", async () => {
    requireActiveUser.mockResolvedValue({ role: "ADMIN", fullName: "Admin" });
    getSelectedEvent.mockResolvedValue(null);

    await expect(DashboardPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/select-event");
  });
});
