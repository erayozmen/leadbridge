import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError } from "@/features/auth/types/auth";

const { getSelectedEvent, getUnreadNotificationCount, listSelectableEvents, redirect, requireActiveUser } = vi.hoisted(() => ({
  getSelectedEvent: vi.fn(),
  getUnreadNotificationCount: vi.fn(),
  listSelectableEvents: vi.fn(),
  redirect: vi.fn(() => { throw new Error("NEXT_REDIRECT"); }),
  requireActiveUser: vi.fn(),
}));

vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/features/auth/server/auth", () => ({ requireActiveUser }));
vi.mock("@/features/events/server/event-context", () => ({ getSelectedEvent, listSelectableEvents }));
vi.mock("@/features/notifications/queries/list-notifications", () => ({ getUnreadNotificationCount }));
vi.mock("@/components/dashboard/app-sidebar", () => ({ AppSidebar: vi.fn(() => null) }));
vi.mock("@/components/dashboard/dashboard-header", () => ({ DashboardHeader: vi.fn(() => null) }));

import DashboardLayout from "@/app/(dashboard)/dashboard/layout";

describe("authenticated dashboard layout", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not query events or notifications without an authenticated user", async () => {
    requireActiveUser.mockRejectedValue(new AuthError("UNAUTHENTICATED"));

    await expect(DashboardLayout({ children: null })).rejects.toThrow("NEXT_REDIRECT");

    expect(redirect).toHaveBeenCalledWith("/login");
    expect(listSelectableEvents).not.toHaveBeenCalled();
    expect(getSelectedEvent).not.toHaveBeenCalled();
    expect(getUnreadNotificationCount).not.toHaveBeenCalled();
  });

  it("renders safely for an authenticated user without an event cookie", async () => {
    requireActiveUser.mockResolvedValue({ id: "user_1", role: "ADMIN", fullName: "Admin", email: "admin@example.test" });
    listSelectableEvents.mockResolvedValue([]);
    getSelectedEvent.mockResolvedValue(null);
    getUnreadNotificationCount.mockResolvedValue(0);

    await expect(DashboardLayout({ children: null })).resolves.toBeTruthy();
  });
});
