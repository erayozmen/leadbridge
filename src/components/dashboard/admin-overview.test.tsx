import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  AdminOverview,
  buildDashboardOverviewMetrics,
} from "@/components/dashboard/admin-overview";
import type { DashboardOverviewSummary } from "@/features/reports/types/dashboard-overview-summary";

const summary: DashboardOverviewSummary = {
  totalVrRecords: 11,
  distributedQrCodes: 22,
  totalQrRegistrations: 33,
  attendedRegistrations: 44,
  courseEnrollments: 55,
  assignedWithoutRegistration: 6,
  registeredNotAttended: 7,
  attendedNotEnrolled: 8,
  unmatchedRegistrations: 9,
  unmatchedVrRecords: 10,
};

describe("admin overview", () => {
  it("uses one metric model for cards and funnel", () => {
    expect(buildDashboardOverviewMetrics(summary).map(({ value }) => value)).toEqual([11, 22, 33, 44, 55]);
    const html = renderToStaticMarkup(<AdminOverview summary={summary} />);
    for (const value of [11, 22, 33, 44, 55]) {
      expect(html.match(new RegExp(`>${value}<`, "g"))?.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("renders zero values as 0", () => {
    const zero = Object.fromEntries(Object.keys(summary).map((key) => [key, 0])) as DashboardOverviewSummary;
    const html = renderToStaticMarkup(<AdminOverview summary={zero} />);
    expect(html).toContain(">0<");
    expect(html).not.toContain("—");
  });

  it("removes stale placeholders and detailed report metrics", () => {
    const html = renderToStaticMarkup(<AdminOverview summary={summary} />);
    expect(html).not.toContain("Veriler henüz bağlanmadı");
    expect(html).not.toContain("Veri bekleniyor");
    expect(html).not.toContain("Henüz hareket yok");
    expect(html).not.toContain("Arşivlenmiş QR");
    expect(html).not.toContain("Eşleşmemiş VR Kaydı");
  });
});
