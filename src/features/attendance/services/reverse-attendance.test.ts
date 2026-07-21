import { UserRole, UserStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { AUDIT_ACTIONS } from "@/features/audit/constants/audit-actions";
import { AUDIT_ENTITY_TYPES } from "@/features/audit/constants/audit-entity-types";
import { AuthError, type AppUser } from "@/features/auth/types/auth";
import {
  reverseAttendance,
  type ReverseAttendanceDependencies,
} from "@/features/attendance/services/reverse-attendance";

vi.mock("server-only", () => ({}));

const admin: AppUser = {
  id: "admin_1",
  authUserId: "auth_1",
  email: "admin@example.test",
  fullName: "Admin User",
  role: UserRole.ADMIN,
  status: UserStatus.ACTIVE,
};
const attendedAt = new Date("2026-07-20T12:00:00.000Z");
const initialState = {
  id: "registration_1",
  attendedEvent: true,
  attendedAt,
  attendedByUserId: "staff_1",
};
const input = {
  qrRegistrationId: "registration_1",
  reason: "Yanlış katılım işaretlendi",
};

type Options = {
  found?: boolean;
  attendedEvent?: boolean;
  attendedAt?: Date | null;
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
          attendedEvent: options.attendedEvent ?? true,
          attendedAt: options.attendedAt === undefined
            ? attendedAt
            : options.attendedAt,
        },
    auditCount: 0,
  };
  const transaction = {
    findRegistration: vi.fn(async () => {
      if (options.databaseError) throw new Error("sensitive database detail");
      return state.registration ? { ...state.registration } : null;
    }),
    clearAttendance: vi.fn(async (registration: typeof initialState) => {
      if (options.databaseError) throw new Error("sensitive database detail");
      const count = options.updateCount ?? 1;
      if (count === 1 && state.registration?.id === registration.id) {
        state.registration = {
          ...state.registration,
          attendedEvent: false,
          attendedAt: null,
          attendedByUserId: null,
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
  const deps: ReverseAttendanceDependencies = {
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

describe("reverseAttendance", () => {
  it("allows ADMIN to clear all attendance fields and write audit", async () => {
    const { deps, state } = dependencies();
    await expect(reverseAttendance(input, deps)).resolves.toEqual({ ok: true });
    expect(state.registration).toMatchObject({
      id: "registration_1",
      attendedEvent: false,
      attendedAt: null,
      attendedByUserId: null,
    });
    expect(state.auditCount).toBe(1);
  });

  it("rejects STAFF in the service before transaction access", async () => {
    const { deps } = dependencies();
    deps.requireAdmin = vi.fn(async () => { throw new AuthError("FORBIDDEN"); });
    await expect(reverseAttendance(input, deps)).resolves.toMatchObject({ code: "UNAUTHORIZED" });
    expect(deps.runTransaction).not.toHaveBeenCalled();
  });

  it("rejects blank and short reasons before authorization", async () => {
    for (const reason of ["   ", "çok kısa"]) {
      const { deps } = dependencies();
      await expect(reverseAttendance({ ...input, reason }, deps)).resolves.toMatchObject({ code: "INVALID_INPUT" });
      expect(deps.requireAdmin).not.toHaveBeenCalled();
    }
  });

  it("trims reason and writes the exact safe audit payload", async () => {
    const { deps, transaction } = dependencies();
    await reverseAttendance({ ...input, reason: "  Yanlış katılım işaretlendi  " }, deps);
    expect(transaction.writeAudit).toHaveBeenCalledWith({
      actor: { type: "USER", userId: "admin_1" },
      action: AUDIT_ACTIONS.ATTENDANCE_REVERSED,
      entityType: AUDIT_ENTITY_TYPES.QR_REGISTRATION,
      entityId: "registration_1",
      reason: "Yanlış katılım işaretlendi",
      beforeData: {
        attendedEvent: true,
        attendedAt: attendedAt.toISOString(),
        attendedByUserId: "staff_1",
      },
      afterData: {
        attendedEvent: false,
        attendedAt: null,
        attendedByUserId: null,
      },
    });
    const payload = JSON.stringify(transaction.writeAudit.mock.calls[0][0]);
    expect(payload).not.toMatch(/firstName|lastName|phone|school|token|serialNumber|authUserId/);
  });

  it("returns not found without update or audit", async () => {
    const { deps, transaction } = dependencies({ found: false });
    await expect(reverseAttendance(input, deps)).resolves.toMatchObject({ code: "REGISTRATION_NOT_FOUND" });
    expect(transaction.clearAttendance).not.toHaveBeenCalled();
    expect(transaction.writeAudit).not.toHaveBeenCalled();
  });

  it("rejects already reversed attendance without update or audit", async () => {
    const { deps, transaction } = dependencies({ attendedEvent: false, attendedAt: null });
    await expect(reverseAttendance(input, deps)).resolves.toMatchObject({ code: "NOT_ATTENDED" });
    expect(transaction.clearAttendance).not.toHaveBeenCalled();
    expect(transaction.writeAudit).not.toHaveBeenCalled();
  });

  it("rejects an invalid attended state without update or audit", async () => {
    const { deps, transaction } = dependencies({ attendedAt: null });
    await expect(reverseAttendance(input, deps)).resolves.toMatchObject({ code: "ATTENDANCE_STATE_INVALID" });
    expect(transaction.clearAttendance).not.toHaveBeenCalled();
    expect(transaction.writeAudit).not.toHaveBeenCalled();
  });

  it("does not audit when the conditional update loses a race", async () => {
    const { deps, transaction } = dependencies({ updateCount: 0 });
    await expect(reverseAttendance(input, deps)).resolves.toMatchObject({ code: "ATTENDANCE_REVERSAL_CONFLICT" });
    expect(transaction.writeAudit).not.toHaveBeenCalled();
  });

  it("rolls attendance fields back when audit insertion fails", async () => {
    const { deps, state } = dependencies({ auditError: true });
    await expect(reverseAttendance(input, deps)).resolves.toMatchObject({ code: "ATTENDANCE_REVERSAL_FAILED" });
    expect(state.registration).toEqual(initialState);
    expect(state.auditCount).toBe(0);
  });

  it("maps and hides raw transaction errors", async () => {
    const result = await reverseAttendance(input, dependencies({ databaseError: true }).deps);
    expect(result).toMatchObject({ code: "ATTENDANCE_REVERSAL_FAILED" });
    expect(JSON.stringify(result)).not.toContain("sensitive database detail");
  });
});
