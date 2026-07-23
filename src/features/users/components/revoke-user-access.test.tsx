import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AUDIT_ACTIONS } from "@/features/audit/constants/audit-actions";
import { isAuditReasonValid } from "@/features/audit/lib/validate-audit-input";

vi.mock("@/features/users/actions/user-actions", () => ({
  revokeUserAccessAction: vi.fn(),
}));

import { RevokeUserAccess } from "@/features/users/components/revoke-user-access";

describe("RevokeUserAccess", () => {
  it("does not expose mutation fields before explicit confirmation", () => {
    const html = renderToStaticMarkup(<RevokeUserAccess userId="user_2" disabled={false} />);
    expect(html).toContain("Erişimi Kaldır");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("user_2");
  });

  it("disables self and last-admin entry points", () => {
    const html = renderToStaticMarkup(<RevokeUserAccess userId="admin_1" disabled />);
    expect(html).toContain("disabled");
  });

  it("uses the shared mandatory reason policy", () => {
    expect(isAuditReasonValid(AUDIT_ACTIONS.USER_ACCESS_REVOKED, "kısa")).toBe(false);
    expect(isAuditReasonValid(AUDIT_ACTIONS.USER_ACCESS_REVOKED, "Kullanıcı kurumdan ayrıldı")).toBe(true);
  });
});
