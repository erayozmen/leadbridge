import { describe, expect, it } from "vitest";

import { getDashboardNavigation } from "@/components/dashboard/navigation";

describe("dashboard navigation", () => {
  it("includes administration modules for ADMIN", () => {
    const labels = getDashboardNavigation("ADMIN").map((item) => item.label);

    expect(labels).toContain("Genel Bakış");
    expect(labels.filter((label) => label.startsWith("VR"))).toEqual(["VR Kaydı", "VR CSV İçe Aktar", "VR İzleyenler"]);
    expect(labels).toContain("Raporlar");
    expect(labels).toContain("Kullanıcılar");
    expect(labels).toContain("Okullar");
    expect(labels).toContain("Dil Kursu Kayıtları");
    expect(labels).toContain("Etkinlikler");
    expect(labels).not.toContain("Bildirimler");
  });

  it("limits STAFF navigation to operational modules", () => {
    const labels = getDashboardNavigation("STAFF").map((item) => item.label);

    expect(labels).toEqual(["VR Kaydı", "VR İzleyenler", "Etkinlik Katılımı", "QR Tarayıcı"]);
    expect(labels).not.toContain("Raporlar");
    expect(labels).not.toContain("Kullanıcılar");
    expect(labels).not.toContain("Okullar");
    expect(labels).not.toContain("Dil Kursu Kayıtları");
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

  it("routes only ADMIN to reports", () => {
    expect(getDashboardNavigation("ADMIN")).toContainEqual(
      expect.objectContaining({ label: "Raporlar", href: "/dashboard/reports" }),
    );
    expect(getDashboardNavigation("STAFF").some((item) => item.icon === "reports")).toBe(false);
  });
});
