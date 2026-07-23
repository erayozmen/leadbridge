import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireAdmin, getReportSummary } = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getReportSummary: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/features/auth/server/auth", () => ({ requireAdmin }));
vi.mock("@/features/reports/queries/get-report-summary", () => ({ getReportSummary }));
vi.mock("@/features/events/server/event-filter", () => ({
  resolveEventFilter: vi.fn(async () => ({ id: "event_1", name: "Etkinlik", status: "ACTIVE" })),
  listEventFilterOptions: vi.fn(async () => [{ id: "event_1", name: "Etkinlik", status: "ACTIVE" }]),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { school: { count: vi.fn() }, qrCode: { count: vi.fn() }, vrRecord: { count: vi.fn() }, qrRegistration: { count: vi.fn() }, studentMatch: { count: vi.fn() } } }));

import ReportsPage from "@/app/(dashboard)/dashboard/reports/page";

describe("reports page authorization", () => {
  beforeEach(() => {
    requireAdmin.mockReset();
    getReportSummary.mockReset();
    requireAdmin.mockResolvedValue({ role: "ADMIN" });
    getReportSummary.mockResolvedValue({
      totalSchools: 0, totalQrCodes: 0, assignedQrCodes: 0, usedQrCodes: 0,
      archivedQrCodes: 0, totalVrRecords: 0, totalQrRegistrations: 0,
      totalMatches: 0, unmatchedVrRecords: 0, unmatchedQrRegistrations: 0,
      attendedRegistrations: 0, notAttendedRegistrations: 0, courseEnrollments: 0,
    });
  });

  it("checks ADMIN access before loading the report", async () => {
    await ReportsPage({ searchParams: Promise.resolve({}) });
    expect(requireAdmin).toHaveBeenCalledOnce();
    expect(getReportSummary).toHaveBeenCalledOnce();
    expect(requireAdmin.mock.invocationCallOrder[0]).toBeLessThan(
      getReportSummary.mock.invocationCallOrder[0],
    );
  });

  it("does not query report data when route authorization fails", async () => {
    requireAdmin.mockRejectedValue(new Error("forbidden"));
    await expect(ReportsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("forbidden");
    expect(getReportSummary).not.toHaveBeenCalled();
  });
});
