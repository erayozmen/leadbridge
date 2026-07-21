import { UserRole, UserStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { AUDIT_ACTIONS } from "@/features/audit/constants/audit-actions";
import { AUDIT_ENTITY_TYPES } from "@/features/audit/constants/audit-entity-types";
import { AuthError, type AppUser } from "@/features/auth/types/auth";
import {
  deleteStudentMatch,
  type DeleteStudentMatchDependencies,
} from "@/features/student-matching/services/delete-student-match";

vi.mock("server-only", () => ({}));

const admin: AppUser = {
  id: "admin_1",
  authUserId: "auth_1",
  email: "admin@example.test",
  fullName: "Admin User",
  role: UserRole.ADMIN,
  status: UserStatus.ACTIVE,
};

type Options = {
  match?: { id: string; vrRecordId: string; qrRegistrationId: string } | null;
  deleteCount?: number;
  auditError?: boolean;
  databaseError?: boolean;
};

function dependencies(options: Options = {}) {
  const state = { deleted: false, auditCount: 0 };
  const transaction = {
    findMatch: vi.fn(async () => {
      if (options.databaseError) throw new Error("raw database detail");
      return options.match === undefined
        ? { id: "match_1", vrRecordId: "vr_1", qrRegistrationId: "registration_1" }
        : options.match;
    }),
    deleteMatch: vi.fn(async () => {
      if (options.databaseError) throw new Error("raw database detail");
      const count = options.deleteCount ?? 1;
      if (count === 1) state.deleted = true;
      return count;
    }),
    writeAudit: vi.fn(async () => {
      if (options.auditError) throw new Error("audit insert failed");
      state.auditCount += 1;
      return { id: "audit_1", createdAt: new Date() };
    }),
  };
  const deps: DeleteStudentMatchDependencies = {
    requireAdmin: vi.fn(async () => admin),
    runTransaction: vi.fn(async (callback) => {
      const snapshot = { ...state };
      try {
        return await callback(transaction);
      } catch (error) {
        state.deleted = snapshot.deleted;
        state.auditCount = snapshot.auditCount;
        throw error;
      }
    }),
  };
  return { deps, transaction, state };
}

const input = {
  matchId: "match_1",
  vrRecordId: "vr_1",
  reason: "Yanlış öğrenciler eşleştirildi",
};

describe("deleteStudentMatch", () => {
  it("removes the match and writes audit for ADMIN", async () => {
    const { deps, state } = dependencies();
    await expect(deleteStudentMatch(input, deps)).resolves.toMatchObject({ ok: true });
    expect(state).toEqual({ deleted: true, auditCount: 1 });
  });

  it("rejects STAFF before opening a transaction", async () => {
    const { deps } = dependencies();
    deps.requireAdmin = vi.fn(async () => { throw new AuthError("FORBIDDEN"); });
    await expect(deleteStudentMatch(input, deps)).resolves.toMatchObject({ code: "UNAUTHORIZED" });
    expect(deps.runTransaction).not.toHaveBeenCalled();
  });

  it("rejects blank or short reason before authorization", async () => {
    for (const reason of ["   ", "çok kısa"]) {
      const { deps } = dependencies();
      await expect(deleteStudentMatch({ ...input, reason }, deps)).resolves.toMatchObject({ code: "INVALID_INPUT" });
      expect(deps.requireAdmin).not.toHaveBeenCalled();
    }
  });

  it("trims reason and uses authenticated app user id", async () => {
    const { deps, transaction } = dependencies();
    await deleteStudentMatch({ ...input, reason: "  Yanlış öğrenciler eşleştirildi  " }, deps);
    expect(transaction.writeAudit).toHaveBeenCalledWith(expect.objectContaining({
      actor: { type: "USER", userId: "admin_1" },
      reason: "Yanlış öğrenciler eşleştirildi",
    }));
  });

  it("rejects a mismatched or missing match without audit", async () => {
    for (const match of [
      null,
      { id: "match_1", vrRecordId: "vr_other", qrRegistrationId: "registration_1" },
    ]) {
      const { deps, transaction } = dependencies({ match });
      await expect(deleteStudentMatch(input, deps)).resolves.toMatchObject({ code: "MATCH_NOT_FOUND" });
      expect(transaction.deleteMatch).not.toHaveBeenCalled();
      expect(transaction.writeAudit).not.toHaveBeenCalled();
    }
  });

  it("does not audit when the conditional delete fails", async () => {
    const { deps, transaction } = dependencies({ deleteCount: 0 });
    await expect(deleteStudentMatch(input, deps)).resolves.toMatchObject({ code: "UNMATCH_CONFLICT" });
    expect(transaction.writeAudit).not.toHaveBeenCalled();
  });

  it("rolls delete back when audit insert fails", async () => {
    const { deps, state } = dependencies({ auditError: true });
    await expect(deleteStudentMatch(input, deps)).resolves.toMatchObject({ code: "UNMATCH_FAILED" });
    expect(state).toEqual({ deleted: false, auditCount: 0 });
  });

  it("writes the minimal StudentMatch removal payload", async () => {
    const { deps, transaction } = dependencies();
    await deleteStudentMatch(input, deps);
    expect(transaction.writeAudit).toHaveBeenCalledWith({
      actor: { type: "USER", userId: "admin_1" },
      action: AUDIT_ACTIONS.STUDENT_MATCH_REMOVED,
      entityType: AUDIT_ENTITY_TYPES.STUDENT_MATCH,
      entityId: "match_1",
      relatedEntity: { type: AUDIT_ENTITY_TYPES.VR_RECORD, id: "vr_1" },
      reason: input.reason,
      beforeData: {
        matchId: "match_1",
        vrRecordId: "vr_1",
        qrRegistrationId: "registration_1",
      },
    });
    const payload = JSON.stringify(transaction.writeAudit.mock.calls[0][0]);
    expect(payload).not.toMatch(/firstName|lastName|phone|school|token|tokenHash/);
  });

  it("hides raw transaction failures", async () => {
    const result = await deleteStudentMatch(input, dependencies({ databaseError: true }).deps);
    expect(result).toMatchObject({ ok: false, code: "UNMATCH_FAILED" });
    expect(JSON.stringify(result)).not.toContain("raw database detail");
  });
});
