import { describe, expect, it, vi } from "vitest";
import { AuthError } from "@/features/auth/types/auth";
import {
  deleteStudentMatch,
  type DeleteStudentMatchDependencies,
} from "@/features/student-matching/services/delete-student-match";

vi.mock("server-only", () => ({}));

type Options = {
  match?: { id: string; vrRecordId: string } | null;
  deleteCount?: number;
  error?: boolean;
};

function dependencies(options: Options = {}): DeleteStudentMatchDependencies {
  return {
    requireAdmin: vi.fn(async () => ({})),
    findMatch: vi.fn(async () => {
      if (options.error) throw new Error("raw database detail");
      return options.match === undefined
        ? { id: "match_1", vrRecordId: "vr_1" }
        : options.match;
    }),
    deleteMatch: vi.fn(async () => {
      if (options.error) throw new Error("raw database detail");
      return options.deleteCount ?? 1;
    }),
  };
}

const input = { matchId: "match_1", vrRecordId: "vr_1" };

describe("deleteStudentMatch", () => {
  it("allows ADMIN to remove the matching StudentMatch", async () => {
    await expect(deleteStudentMatch(input, dependencies())).resolves.toMatchObject({ ok: true });
  });

  it("rejects STAFF in the service", async () => {
    const state = dependencies();
    state.requireAdmin = vi.fn(async () => { throw new AuthError("FORBIDDEN"); });
    await expect(deleteStudentMatch(input, state)).resolves.toMatchObject({ code: "UNAUTHORIZED" });
    expect(state.findMatch).not.toHaveBeenCalled();
  });

  it("rejects invalid input before authorization or database access", async () => {
    const state = dependencies();
    await expect(deleteStudentMatch({ matchId: "", vrRecordId: "vr_1" }, state)).resolves.toMatchObject({ code: "INVALID_INPUT" });
    expect(state.requireAdmin).not.toHaveBeenCalled();
    expect(state.findMatch).not.toHaveBeenCalled();
  });

  it("deletes only the match tied to the requested VR record", async () => {
    const state = dependencies();
    await deleteStudentMatch(input, state);
    expect(state.findMatch).toHaveBeenCalledWith("match_1");
    expect(state.deleteMatch).toHaveBeenCalledWith("match_1", "vr_1");
  });

  it("does not delete a match tied to another VR record", async () => {
    const state = dependencies({ match: { id: "match_1", vrRecordId: "vr_other" } });
    await expect(deleteStudentMatch(input, state)).resolves.toMatchObject({ code: "MATCH_NOT_FOUND" });
    expect(state.deleteMatch).not.toHaveBeenCalled();
  });

  it("returns MATCH_NOT_FOUND when the match no longer exists", async () => {
    await expect(deleteStudentMatch(input, dependencies({ match: null }))).resolves.toMatchObject({
      ok: false,
      code: "MATCH_NOT_FOUND",
    });
  });

  it("returns a conflict when the conditional delete affects no row", async () => {
    await expect(deleteStudentMatch(input, dependencies({ deleteCount: 0 }))).resolves.toMatchObject({
      ok: false,
      code: "UNMATCH_CONFLICT",
    });
  });

  it("hides raw database failures", async () => {
    const result = await deleteStudentMatch(input, dependencies({ error: true }));
    expect(result).toMatchObject({ ok: false, code: "UNMATCH_FAILED" });
    expect(JSON.stringify(result)).not.toContain("raw database detail");
  });

  it("exposes no mutation dependency for VR, QR registration, QR, attendance, course, or assignment", () => {
    expect(Object.keys(dependencies())).toEqual(["requireAdmin", "findMatch", "deleteMatch"]);
  });
});
