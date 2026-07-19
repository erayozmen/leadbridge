import { describe, expect, it } from "vitest";
import { buildReportMetricGroups } from "@/features/reports/components/report-summary-cards";
import type { ReportSummary } from "@/features/reports/types/report-summary";

const emptySummary: ReportSummary = {
  totalSchools: 0,
  totalQrCodes: 0,
  assignedQrCodes: 0,
  usedQrCodes: 0,
  archivedQrCodes: 0,
  totalVrRecords: 0,
  totalQrRegistrations: 0,
  totalMatches: 0,
  unmatchedVrRecords: 0,
  unmatchedQrRegistrations: 0,
  attendedRegistrations: 0,
  notAttendedRegistrations: 0,
  courseEnrollments: 0,
};

describe("report summary cards", () => {
  it("preserves zero values instead of showing placeholders", () => {
    const metrics = buildReportMetricGroups(emptySummary).flatMap((group) => group.metrics);
    expect(metrics).toHaveLength(13);
    expect(metrics.every((metric) => metric.value === 0)).toBe(true);
  });

  it("does not expose unreliable student or event metrics", () => {
    const labels = buildReportMetricGroups(emptySummary)
      .flatMap((group) => group.metrics)
      .map((metric) => metric.label);
    expect(labels).not.toContain("Toplam Öğrenci");
    expect(labels).not.toContain("Toplam Etkinlik");
    expect(labels).toEqual(expect.arrayContaining(["VR Kaydı", "QR Kaydı", "Eşleşme"]));
  });
});
