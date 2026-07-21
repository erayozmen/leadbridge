import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AUDIT_ACTIONS } from "@/features/audit/constants/audit-actions";
import { isAuditReasonValid } from "@/features/audit/lib/validate-audit-input";

vi.mock("@/features/attendance/actions/attendance-actions", () => ({
  reverseAttendanceAction: vi.fn(),
}));

import { ReverseAttendanceButton } from "@/features/attendance/components/reverse-attendance-button";

describe("ReverseAttendanceButton", () => {
  it("does not expose mutation fields before explicit first confirmation", () => {
    const html = renderToStaticMarkup(
      <ReverseAttendanceButton id="registration_1" studentName="Ayşe Yılmaz" />,
    );
    expect(html).toContain("Katılımı Geri Al");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("registration_1");
    expect(html).not.toContain("İşlem nedeni");
  });

  it("requires a valid reason for final confirmation", () => {
    expect(isAuditReasonValid(AUDIT_ACTIONS.ATTENDANCE_REVERSED, "çok kısa")).toBe(false);
    expect(isAuditReasonValid(AUDIT_ACTIONS.ATTENDANCE_REVERSED, "Yanlış katılım işaretlendi")).toBe(true);
  });
});
