import { QrCodeStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  getReportSummary,
  type ReportSummaryDependencies,
} from "@/features/reports/queries/get-report-summary";

vi.mock("server-only", () => ({}));

function dependencies(): ReportSummaryDependencies {
  return {
    requireAdmin: vi.fn(async () => ({})),
    countSchools: vi.fn(async () => 1),
    countQrCodes: vi.fn()
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(5),
    countVrRecords: vi.fn()
      .mockResolvedValueOnce(6)
      .mockResolvedValueOnce(9),
    countQrRegistrations: vi.fn()
      .mockResolvedValueOnce(7)
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(11)
      .mockResolvedValueOnce(12)
      .mockResolvedValueOnce(13),
    countStudentMatches: vi.fn(async () => 8),
  };
}

describe("report summary query", () => {
  it("requires ADMIN before reading report counts", async () => {
    const state = dependencies();
    await getReportSummary(state);
    expect(state.requireAdmin).toHaveBeenCalledOnce();
    expect(state.countSchools).toHaveBeenCalled();
  });

  it("rejects unauthorized access without running counts", async () => {
    const state = dependencies();
    vi.mocked(state.requireAdmin).mockRejectedValue(new Error("forbidden"));
    await expect(getReportSummary(state)).rejects.toThrow("forbidden");
    expect(state.countSchools).not.toHaveBeenCalled();
    expect(state.countQrCodes).not.toHaveBeenCalled();
  });

  it("returns all summary values with stable field names", async () => {
    await expect(getReportSummary(dependencies())).resolves.toEqual({
      totalSchools: 1,
      totalQrCodes: 2,
      assignedQrCodes: 3,
      usedQrCodes: 4,
      archivedQrCodes: 5,
      totalVrRecords: 6,
      totalQrRegistrations: 7,
      totalMatches: 8,
      unmatchedVrRecords: 9,
      unmatchedQrRegistrations: 10,
      attendedRegistrations: 11,
      notAttendedRegistrations: 12,
      courseEnrollments: 13,
    });
  });

  it("uses exact QR status and archive filters", async () => {
    const state = dependencies();
    await getReportSummary(state);
    expect(state.countQrCodes).toHaveBeenNthCalledWith(1, {});
    expect(state.countQrCodes).toHaveBeenNthCalledWith(2, { status: QrCodeStatus.ASSIGNED });
    expect(state.countQrCodes).toHaveBeenNthCalledWith(3, { status: QrCodeStatus.USED });
    expect(state.countQrCodes).toHaveBeenNthCalledWith(4, { archivedAt: { not: null } });
  });

  it("uses relation filters for unmatched records", async () => {
    const state = dependencies();
    await getReportSummary(state);
    expect(state.countVrRecords).toHaveBeenNthCalledWith(2, { studentMatch: { is: null } });
    expect(state.countQrRegistrations).toHaveBeenNthCalledWith(2, { studentMatch: { is: null } });
  });

  it("uses boolean filters for attendance and course enrollment", async () => {
    const state = dependencies();
    await getReportSummary(state);
    expect(state.countQrRegistrations).toHaveBeenNthCalledWith(3, { attendedEvent: true });
    expect(state.countQrRegistrations).toHaveBeenNthCalledWith(4, { attendedEvent: false });
    expect(state.countQrRegistrations).toHaveBeenNthCalledWith(5, { enrolledCourse: true });
  });
});
