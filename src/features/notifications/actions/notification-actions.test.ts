import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireActiveUser, updateMany, revalidatePath } = vi.hoisted(() => ({
  requireActiveUser: vi.fn(),
  updateMany: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/features/auth/server/auth", () => ({ requireActiveUser }));
vi.mock("@/lib/prisma", () => ({
  prisma: { notification: { updateMany } },
}));
vi.mock("next/cache", () => ({ revalidatePath }));

import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/features/notifications/actions/notification-actions";

describe("notification actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireActiveUser.mockResolvedValue({ id: "user_1" });
    updateMany.mockResolvedValue({ count: 1 });
  });

  it("marks only the authenticated user's notification as read", async () => {
    const data = new FormData();
    data.set("notificationId", "notification_1");
    await markNotificationReadAction(data);
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "notification_1", userId: "user_1", readAt: null },
    }));
  });

  it("ignores invalid ids without a database mutation", async () => {
    await markNotificationReadAction(new FormData());
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("marks all unread notifications for only the current user", async () => {
    await markAllNotificationsReadAction();
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "user_1", readAt: null },
    }));
  });
});
