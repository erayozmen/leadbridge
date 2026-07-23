import { beforeEach, describe, expect, it, vi } from "vitest";

const { redirect, requireActiveUser } = vi.hoisted(() => ({
  redirect: vi.fn(() => { throw new Error("NEXT_REDIRECT"); }),
  requireActiveUser: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/features/auth/server/auth", () => ({ requireActiveUser }));

import NotificationsPage from "@/app/(dashboard)/dashboard/notifications/page";

describe("disabled v1.2 UI routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireActiveUser.mockResolvedValue({ id: "user_1", role: "STAFF" });
  });

  it("redirects authenticated users from notifications without a server error", async () => {
    await expect(NotificationsPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });
});
