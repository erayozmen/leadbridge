import { beforeEach, describe, expect, it, vi } from "vitest";

const { redirect, requireActiveUser } = vi.hoisted(() => ({
  redirect: vi.fn(() => { throw new Error("NEXT_REDIRECT"); }),
  requireActiveUser: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/features/auth/server/auth", () => ({ requireActiveUser }));

import EventsPage from "@/app/(dashboard)/dashboard/events/page";
import NotificationsPage from "@/app/(dashboard)/dashboard/notifications/page";

describe("disabled v1.2 UI routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireActiveUser.mockResolvedValue({ id: "user_1", role: "STAFF" });
  });

  it.each([
    ["events", EventsPage],
    ["notifications", NotificationsPage],
  ])("redirects authenticated users from %s without a server error", async (_name, page) => {
    await expect(page()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });
});
