import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AUDIT_ACTIONS } from "@/features/audit/constants/audit-actions";
import { isAuditReasonValid } from "@/features/audit/lib/validate-audit-input";

vi.mock("@/features/course-enrollments/actions/course-enrollment-actions", () => ({
  reverseCourseEnrollmentAction: vi.fn(),
}));

import { ReverseCourseEnrollmentButton } from "@/features/course-enrollments/components/reverse-course-enrollment-button";

describe("ReverseCourseEnrollmentButton", () => {
  it("does not expose mutation fields before first confirmation", () => {
    const html = renderToStaticMarkup(
      <ReverseCourseEnrollmentButton id="registration_1" studentName="Ayşe Yılmaz" />,
    );
    expect(html).toContain("Kurs Kaydını Geri Al");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("registration_1");
    expect(html).not.toContain("İşlem nedeni");
  });

  it("requires a valid reason for final confirmation", () => {
    expect(isAuditReasonValid(AUDIT_ACTIONS.COURSE_ENROLLMENT_REVERSED, "çok kısa")).toBe(false);
    expect(isAuditReasonValid(AUDIT_ACTIONS.COURSE_ENROLLMENT_REVERSED, "Yanlış kurs kaydı işaretlendi")).toBe(true);
  });
});
