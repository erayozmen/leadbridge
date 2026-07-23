import { beforeEach, describe, expect, it, vi } from "vitest";

const { count, requireActiveUser } = vi.hoisted(() => ({
  count: vi.fn(),
  requireActiveUser: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/features/auth/server/auth", () => ({ requireActiveUser }));
vi.mock("@/lib/prisma", () => ({
  prisma: { notification: { count } },
}));

import { getUnreadNotificationCount } from "@/features/notifications/queries/list-notifications";

describe("unread notification count", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireActiveUser.mockResolvedValue({ id: "user_1" });
    count.mockResolvedValue(3);
  });

  it("uses a count scoped to the authenticated user", async () => {
    await expect(getUnreadNotificationCount()).resolves.toBe(3);
    expect(count).toHaveBeenCalledWith({
      where: { userId: "user_1", readAt: null },
    });
  });
});
