import { describe, expect, it } from "vitest";

import { getDashboardNavigation } from "@/components/dashboard/navigation";

describe("dashboard navigation", () => {
  it("includes administration modules for ADMIN", () => {
    const labels = getDashboardNavigation("ADMIN").map((item) => item.label);

    expect(labels).toContain("Genel Bakış");
    expect(labels.filter((label) => label.startsWith("VR"))).toEqual(["VR Kaydı", "VR İzleyenler"]);
    expect(labels).toContain("Raporlar");
    expect(labels).toContain("Kullanıcılar");
    expect(labels).toContain("Okullar");
  });

  it("limits STAFF navigation to operational modules", () => {
    const labels = getDashboardNavigation("STAFF").map((item) => item.label);

    expect(labels).toEqual(["VR Kaydı", "VR İzleyenler", "Etkinlik Katılımı"]);
    expect(labels).not.toContain("Raporlar");
    expect(labels).not.toContain("Kullanıcılar");
    expect(labels).not.toContain("Okullar");
  });

  it("routes both roles to separate VR create and list screens", () => {
    for (const role of ["ADMIN", "STAFF"] as const) {
      expect(getDashboardNavigation(role)).toEqual(expect.arrayContaining([
        expect.objectContaining({ label: "VR Kaydı", href: "/dashboard/vr-records/new" }),
        expect.objectContaining({ label: "VR İzleyenler", href: "/dashboard/vr-records" }),
      ]));
    }
  });

  it("routes ADMIN and STAFF attendance navigation to the real module", () => {
    for (const role of ["ADMIN", "STAFF"] as const) {
      const item = getDashboardNavigation(role).find(
        (entry) => entry.icon === "attendance",
      );
      expect(item).toMatchObject({ href: "/dashboard/attendance" });
    }
  });
});
