import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  connection,
  getSelectedEvent,
  listSelectableEvents,
  requireActiveUser,
} = vi.hoisted(() => ({
  connection: vi.fn(),
  getSelectedEvent: vi.fn(),
  listSelectableEvents: vi.fn(),
  requireActiveUser: vi.fn(),
}));

vi.mock("next/server", () => ({ connection }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/features/auth/server/auth", () => ({ requireActiveUser }));
vi.mock("@/features/events/server/event-context", () => ({
  getSelectedEvent,
  listSelectableEvents,
}));
vi.mock("@/components/dashboard/app-sidebar", () => ({
  AppSidebar: vi.fn(() => null),
}));
vi.mock("@/components/dashboard/dashboard-header", () => ({
  DashboardHeader: vi.fn(() => null),
}));

import DashboardLayout from "@/app/(dashboard)/dashboard/layout";

describe("dashboard layout queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connection.mockResolvedValue(undefined);
    requireActiveUser.mockResolvedValue({
      id: "user_1",
      fullName: "Admin",
      email: "admin@example.test",
      role: "ADMIN",
    });
  });

  it("starts independent event queries in parallel after one auth lookup", async () => {
    let resolveEvents!: (value: unknown[]) => void;
    let resolveSelected!: (value: null) => void;
    listSelectableEvents.mockReturnValue(new Promise((resolve) => {
      resolveEvents = resolve;
    }));
    getSelectedEvent.mockReturnValue(new Promise((resolve) => {
      resolveSelected = resolve;
    }));

    const rendering = DashboardLayout({ children: null });
    await vi.waitFor(() => {
      expect(listSelectableEvents).toHaveBeenCalledOnce();
      expect(getSelectedEvent).toHaveBeenCalledOnce();
    });

    expect(requireActiveUser).toHaveBeenCalledOnce();
    resolveEvents([]);
    resolveSelected(null);
    await rendering;
  });
});
