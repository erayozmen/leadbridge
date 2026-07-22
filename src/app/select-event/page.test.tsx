import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError } from "@/features/auth/types/auth";

const { requireActiveUser, listSelectableEvents, redirect } = vi.hoisted(() => ({
  requireActiveUser: vi.fn(),
  listSelectableEvents: vi.fn(),
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/features/auth/server/auth", () => ({ requireActiveUser }));
vi.mock("@/features/events/server/event-context", () => ({ listSelectableEvents }));

import SelectEventPage from "@/app/select-event/page";

describe("select event page", () => {
  beforeEach(() => {
    requireActiveUser.mockReset();
    listSelectableEvents.mockReset();
    redirect.mockClear();
  });

  it("redirects unauthenticated visitors instead of returning a server error", async () => {
    requireActiveUser.mockRejectedValue(new AuthError("UNAUTHENTICATED"));

    await expect(SelectEventPage()).rejects.toThrow("NEXT_REDIRECT");

    expect(redirect).toHaveBeenCalledWith("/login");
    expect(listSelectableEvents).not.toHaveBeenCalled();
  });
});
