import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  createSchool: vi.fn(),
  updateSchool: vi.fn(),
  setSchoolStatus: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/features/auth/server/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/features/schools/services/school-service", () => ({
  createSchool: mocks.createSchool,
  updateSchool: mocks.updateSchool,
  setSchoolStatus: mocks.setSchoolStatus,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import {
  createSchoolAction,
  setSchoolStatusAction,
  updateSchoolAction,
} from "@/features/schools/actions/school-actions";

const initial = { status: "idle" as const, message: null };

describe("school action authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockRejectedValue(new Error("forbidden"));
  });

  it("rejects STAFF from all school mutations", async () => {
    const results = await Promise.all([
      createSchoolAction(initial, new FormData()),
      updateSchoolAction(initial, new FormData()),
      setSchoolStatusAction(initial, new FormData()),
    ]);
    expect(results.every((result) => result.status === "error")).toBe(true);
    expect(mocks.createSchool).not.toHaveBeenCalled();
    expect(mocks.updateSchool).not.toHaveBeenCalled();
    expect(mocks.setSchoolStatus).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
