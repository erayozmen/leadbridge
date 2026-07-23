import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/users/actions/user-actions", () => ({
  updateUserAccessAction: vi.fn(),
}));

import { UserAccessControl } from "@/features/users/components/user-access-control";

describe("UserAccessControl", () => {
  it("keeps permanently revoked users disabled", () => {
    const html = renderToStaticMarkup(
      <UserAccessControl userId="user_1" role="STAFF" status="INACTIVE" isSelf={false} isAccessRevoked />,
    );
    expect(html).toContain("Auth erişimi kalıcı olarak kaldırıldı.");
    expect((html.match(/disabled/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});
