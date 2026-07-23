import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError } from "@/features/auth/types/auth";

const { requireActiveUser, redirect } = vi.hoisted(() => ({
  requireActiveUser: vi.fn(),
  redirect: vi.fn(() => { throw new Error("NEXT_REDIRECT"); }),
}));

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/features/auth/server/auth", () => ({ requireActiveUser }));

import SelectEventPage from "@/app/select-event/page";

describe("disabled event selection route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("redirects unauthenticated visitors to login", async () => {
    requireActiveUser.mockRejectedValue(new AuthError("UNAUTHENTICATED"));
    await expect(SelectEventPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("redirects authenticated users to dashboard", async () => {
    requireActiveUser.mockResolvedValue({ id: "user_1" });
    await expect(SelectEventPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });
});
