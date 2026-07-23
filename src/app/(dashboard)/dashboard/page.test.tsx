import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireActiveUser, getDashboardOverviewSummary } = vi.hoisted(() => ({
  requireActiveUser: vi.fn(),
  getDashboardOverviewSummary: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/features/auth/server/auth", () => ({ requireActiveUser }));
vi.mock("@/features/reports/queries/get-dashboard-overview-summary", () => ({
  getDashboardOverviewSummary,
}));
vi.mock("@/features/events/server/event-filter", () => ({
  resolveEventFilter: vi.fn(async () => ({ id: "event_1", name: "Etkinlik", status: "ACTIVE" })),
  listEventFilterOptions: vi.fn(async () => [{ id: "event_1", name: "Etkinlik", status: "ACTIVE" }]),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { vrRecord: { count: vi.fn() }, qrCode: { count: vi.fn() }, qrRegistration: { count: vi.fn() } } }));

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
    await expect(DashboardPage({ searchParams: Promise.resolve({}) })).resolves.toBeTruthy();
    expect(getDashboardOverviewSummary).toHaveBeenCalledOnce();
  });

  it("opens the STAFF dashboard without an event cookie", async () => {
    requireActiveUser.mockResolvedValue({ role: "STAFF", fullName: "Staff" });
    await expect(DashboardPage({ searchParams: Promise.resolve({}) })).resolves.toBeTruthy();
    expect(getDashboardOverviewSummary).not.toHaveBeenCalled();
  });
});
