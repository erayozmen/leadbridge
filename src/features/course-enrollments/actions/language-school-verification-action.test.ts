import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireAdmin } = vi.hoisted(() => ({ requireAdmin: vi.fn() }));

vi.mock("@/features/auth/server/auth", () => ({ requireAdmin }));

import { verifyLanguageSchoolBatchAction } from "@/features/course-enrollments/actions/language-school-verification-action";

describe("language school verification action", () => {
  beforeEach(() => {
    requireAdmin.mockReset();
    requireAdmin.mockResolvedValue({ id: "admin-1" });
  });

  it("returns unavailable without a provider and does not invent results", async () => {
    await expect(verifyLanguageSchoolBatchAction()).resolves.toEqual({
      status: "INTEGRATION_UNAVAILABLE",
      results: [],
    });
  });

  it("keeps the ADMIN authorization boundary", async () => {
    requireAdmin.mockRejectedValue(new Error("forbidden"));
    await expect(verifyLanguageSchoolBatchAction()).resolves.toEqual({
      status: "INTEGRATION_UNAVAILABLE",
      results: [],
    });
  });
});
