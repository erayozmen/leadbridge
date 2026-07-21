import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AUDIT_ACTIONS } from "@/features/audit/constants/audit-actions";
import { isAuditReasonValid } from "@/features/audit/lib/validate-audit-input";

vi.mock("@/features/student-matching/actions/student-match-actions", () => ({
  createStudentMatchAction: vi.fn(),
  deleteStudentMatchAction: vi.fn(),
}));

import { DeleteMatchButton } from "@/features/student-matching/components/match-action-buttons";

describe("DeleteMatchButton", () => {
  it("does not render the destructive form before confirmation", () => {
    const html = renderToStaticMarkup(
      <DeleteMatchButton
        matchId="match_1"
        vrRecordId="vr_1"
        vrStudentName="Ayşe Yılmaz"
        qrStudentName="Ayşe Yılmaz"
      />,
    );
    expect(html).toContain("Eşleşmeyi Kaldır");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("match_1");
  });

  it("keeps final confirmation unavailable until reason is valid", () => {
    expect(isAuditReasonValid(AUDIT_ACTIONS.STUDENT_MATCH_REMOVED, "kısa")).toBe(false);
    expect(
      isAuditReasonValid(
        AUDIT_ACTIONS.STUDENT_MATCH_REMOVED,
        "Yanlış öğrenciler eşleştirildi",
      ),
    ).toBe(true);
  });
});
