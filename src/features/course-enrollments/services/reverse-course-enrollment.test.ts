import { UserRole, UserStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { AUDIT_ACTIONS } from "@/features/audit/constants/audit-actions";
import { AUDIT_ENTITY_TYPES } from "@/features/audit/constants/audit-entity-types";
import { AuthError, type AppUser } from "@/features/auth/types/auth";
import {
  reverseCourseEnrollment,
  type ReverseCourseEnrollmentDependencies,
} from "@/features/course-enrollments/services/reverse-course-enrollment";

vi.mock("server-only", () => ({}));

const admin: AppUser = {
  id: "admin_1",
  authUserId: "auth_1",
  email: "admin@example.test",
  fullName: "Admin User",
  role: UserRole.ADMIN,
  status: UserStatus.ACTIVE,
};
const enrolledAt = new Date("2026-07-21T09:00:00.000Z");
const initialState = {
  id: "registration_1",
  enrolledCourse: true,
  enrolledAt,
  enrolledByUserId: "admin_2",
};
const input = {
  qrRegistrationId: "registration_1",
  reason: "Yanlış kurs kaydı işaretlendi",
};

type Options = {
  found?: boolean;
  enrolledCourse?: boolean;
  enrolledAt?: Date | null;
  updateCount?: number;
  databaseError?: boolean;
  auditError?: boolean;
};

function dependencies(options: Options = {}) {
  const state = {
    registration: options.found === false
      ? null
      : {
          ...initialState,
          enrolledCourse: options.enrolledCourse ?? true,
          enrolledAt: options.enrolledAt === undefined ? enrolledAt : options.enrolledAt,
        },
    auditCount: 0,
  };
  const transaction = {
    findRegistration: vi.fn(async () => {
      if (options.databaseError) throw new Error("sensitive database detail");
      return state.registration ? { ...state.registration } : null;
    }),
    clearEnrollment: vi.fn(async (registration: typeof initialState) => {
      if (options.databaseError) throw new Error("sensitive database detail");
      const count = options.updateCount ?? 1;
      if (count === 1 && state.registration?.id === registration.id) {
        state.registration = {
          ...state.registration,
          enrolledCourse: false,
          enrolledAt: null,
          enrolledByUserId: null,
        };
      }
      return count;
    }),
    writeAudit: vi.fn(async () => {
      if (options.auditError) throw new Error("audit insert failed");
      state.auditCount += 1;
      return { id: "audit_1", createdAt: new Date() };
    }),
  };
  const deps: ReverseCourseEnrollmentDependencies = {
    requireAdmin: vi.fn(async () => admin),
    runTransaction: vi.fn(async (callback) => {
      const snapshot = {
        registration: state.registration ? { ...state.registration } : null,
        auditCount: state.auditCount,
      };
      try {
        return await callback(transaction);
      } catch (error) {
        state.registration = snapshot.registration;
        state.auditCount = snapshot.auditCount;
        throw error;
      }
    }),
  };
  return { deps, transaction, state };
}

describe("reverseCourseEnrollment", () => {
  it("allows ADMIN to clear all enrollment fields and write audit", async () => {
    const { deps, state } = dependencies();
    await expect(reverseCourseEnrollment(input, deps)).resolves.toEqual({ ok: true });
    expect(state.registration).toMatchObject({
      id: "registration_1",
      enrolledCourse: false,
      enrolledAt: null,
      enrolledByUserId: null,
    });
    expect(state.auditCount).toBe(1);
  });

  it("rejects STAFF before transaction access", async () => {
    const { deps } = dependencies();
    deps.requireAdmin = vi.fn(async () => { throw new AuthError("FORBIDDEN"); });
    await expect(reverseCourseEnrollment(input, deps)).resolves.toMatchObject({ code: "UNAUTHORIZED" });
    expect(deps.runTransaction).not.toHaveBeenCalled();
  });

  it("rejects blank and short reasons before authorization", async () => {
    for (const reason of ["   ", "çok kısa"]) {
      const { deps } = dependencies();
      await expect(reverseCourseEnrollment({ ...input, reason }, deps)).resolves.toMatchObject({ code: "INVALID_INPUT" });
      expect(deps.requireAdmin).not.toHaveBeenCalled();
    }
  });

  it("trims reason and writes exact safe audit data", async () => {
    const { deps, transaction } = dependencies();
    await reverseCourseEnrollment({ ...input, reason: "  Yanlış kurs kaydı işaretlendi  " }, deps);
    expect(transaction.writeAudit).toHaveBeenCalledWith({
      actor: { type: "USER", userId: "admin_1" },
      action: AUDIT_ACTIONS.COURSE_ENROLLMENT_REVERSED,
      entityType: AUDIT_ENTITY_TYPES.QR_REGISTRATION,
      entityId: "registration_1",
      reason: "Yanlış kurs kaydı işaretlendi",
      beforeData: {
        enrolledCourse: true,
        enrolledAt: enrolledAt.toISOString(),
        enrolledByUserId: "admin_2",
      },
      afterData: {
        enrolledCourse: false,
        enrolledAt: null,
        enrolledByUserId: null,
      },
    });
    const payload = JSON.stringify(transaction.writeAudit.mock.calls[0][0]);
    expect(payload).not.toMatch(/firstName|lastName|phone|school|token|serialNumber|authUserId|provider/);
  });

  it("returns not found without update or audit", async () => {
    const { deps, transaction } = dependencies({ found: false });
    await expect(reverseCourseEnrollment(input, deps)).resolves.toMatchObject({ code: "REGISTRATION_NOT_FOUND" });
    expect(transaction.clearEnrollment).not.toHaveBeenCalled();
    expect(transaction.writeAudit).not.toHaveBeenCalled();
  });

  it("rejects already reversed enrollment without update or audit", async () => {
    const { deps, transaction } = dependencies({ enrolledCourse: false, enrolledAt: null });
    await expect(reverseCourseEnrollment(input, deps)).resolves.toMatchObject({ code: "NOT_ENROLLED" });
    expect(transaction.clearEnrollment).not.toHaveBeenCalled();
    expect(transaction.writeAudit).not.toHaveBeenCalled();
  });

  it("rejects inconsistent enrollment state", async () => {
    const { deps, transaction } = dependencies({ enrolledAt: null });
    await expect(reverseCourseEnrollment(input, deps)).resolves.toMatchObject({ code: "ENROLLMENT_STATE_INVALID" });
    expect(transaction.clearEnrollment).not.toHaveBeenCalled();
    expect(transaction.writeAudit).not.toHaveBeenCalled();
  });

  it("does not audit when conditional update loses a race", async () => {
    const { deps, transaction } = dependencies({ updateCount: 0 });
    await expect(reverseCourseEnrollment(input, deps)).resolves.toMatchObject({ code: "ENROLLMENT_REVERSAL_CONFLICT" });
    expect(transaction.writeAudit).not.toHaveBeenCalled();
  });

  it("rolls enrollment fields back when audit insertion fails", async () => {
    const { deps, state } = dependencies({ auditError: true });
    await expect(reverseCourseEnrollment(input, deps)).resolves.toMatchObject({ code: "ENROLLMENT_REVERSAL_FAILED" });
    expect(state.registration).toEqual(initialState);
    expect(state.auditCount).toBe(0);
  });

  it("maps and hides raw transaction errors", async () => {
    const result = await reverseCourseEnrollment(input, dependencies({ databaseError: true }).deps);
    expect(result).toMatchObject({ code: "ENROLLMENT_REVERSAL_FAILED" });
    expect(JSON.stringify(result)).not.toContain("sensitive database detail");
  });
});
