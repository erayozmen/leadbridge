import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AUDIT_ACTIONS } from "@/features/audit/constants/audit-actions";
import { isAuditReasonValid } from "@/features/audit/lib/validate-audit-input";

vi.mock("@/features/vr-records/actions/unassign-qr-code-action", () => ({
  unassignQrCodeAction: vi.fn(),
}));

import { UnassignQrCodeButton } from "@/features/vr-records/components/unassign-qr-code-button";

describe("UnassignQrCodeButton", () => {
  it("does not expose the destructive form before confirmation", () => {
    const html = renderToStaticMarkup(
      <UnassignQrCodeButton
        vrRecordId="vr_1"
        qrCodeId="qr_1"
        serialNumber="LB-000001"
        studentName="Ayşe Yılmaz"
      />,
    );
    expect(html).toContain("QR Atamasını Geri Al");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("qr_1");
  });

  it("keeps final confirmation unavailable until reason is valid", () => {
    expect(isAuditReasonValid(AUDIT_ACTIONS.QR_ASSIGNMENT_REVERSED, "kısa")).toBe(false);
    expect(
      isAuditReasonValid(
        AUDIT_ACTIONS.QR_ASSIGNMENT_REVERSED,
        "QR yanlış öğrenciye verildi",
      ),
    ).toBe(true);
  });
});
