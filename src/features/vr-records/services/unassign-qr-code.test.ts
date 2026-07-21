import { QrCodeStatus, UserRole, UserStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { AUDIT_ACTIONS } from "@/features/audit/constants/audit-actions";
import { AUDIT_ENTITY_TYPES } from "@/features/audit/constants/audit-entity-types";
import { AuthError, type AppUser } from "@/features/auth/types/auth";
import {
  unassignQrCode,
  type UnassignQrCodeDependencies,
} from "@/features/vr-records/services/unassign-qr-code";

vi.mock("server-only", () => ({}));

const admin: AppUser = {
  id: "admin_1",
  authUserId: "auth_1",
  email: "admin@example.test",
  fullName: "Admin User",
  role: UserRole.ADMIN,
  status: UserStatus.ACTIVE,
};
const assignedAt = new Date("2026-07-20T12:00:00.000Z");

type Options = {
  status?: QrCodeStatus;
  usedAt?: Date | null;
  archivedAt?: Date | null;
  hasRegistration?: boolean;
  hasStudentMatch?: boolean;
  assignment?: boolean;
  detachCount?: number;
  releaseCount?: number;
  auditError?: boolean;
  databaseError?: boolean;
};

function dependencies(options: Options = {}) {
  const state = { qrReleased: false, vrDetached: false, auditCount: 0 };
  const transaction = {
    findAssignment: vi.fn(async (vrRecordId: string, qrCodeId: string) => {
      if (options.databaseError) throw new Error("raw database secret");
      if (options.assignment === false || vrRecordId !== "vr_1" || qrCodeId !== "qr_1") return null;
      return {
        vrRecordId: "vr_1",
        assignedQrCodeId: "qr_1",
        hasStudentMatch: options.hasStudentMatch ?? false,
        qrCode: {
          id: "qr_1",
          serialNumber: "LB-000001",
          status: options.status ?? QrCodeStatus.ASSIGNED,
          assignedAt,
          usedAt: options.usedAt ?? null,
          archivedAt: options.archivedAt ?? null,
          hasRegistration: options.hasRegistration ?? false,
        },
      };
    }),
    releaseQrCode: vi.fn(async () => {
      const count = options.releaseCount ?? 1;
      if (count === 1) state.qrReleased = true;
      return count;
    }),
    detachQrFromVrRecord: vi.fn(async () => {
      const count = options.detachCount ?? 1;
      if (count === 1) state.vrDetached = true;
      return count;
    }),
    writeAudit: vi.fn(async () => {
      if (options.auditError) throw new Error("audit insert failed");
      state.auditCount += 1;
      return { id: "audit_1", createdAt: new Date() };
    }),
  };
  const deps: UnassignQrCodeDependencies = {
    requireAdmin: vi.fn(async () => admin),
    runTransaction: vi.fn(async (callback) => {
      const snapshot = { ...state };
      try {
        return await callback(transaction);
      } catch (error) {
        Object.assign(state, snapshot);
        throw error;
      }
    }),
  };
  return { deps, transaction, state };
}

const input = {
  vrRecordId: "vr_1",
  qrCodeId: "qr_1",
  reason: "QR yanlış öğrenciye verildi",
};

describe("unassignQrCode", () => {
  it("releases an unused assignment and writes audit for ADMIN", async () => {
    const { deps, state } = dependencies();
    await expect(unassignQrCode(input, deps)).resolves.toEqual({
      ok: true,
      serialNumber: "LB-000001",
    });
    expect(state).toEqual({ qrReleased: true, vrDetached: true, auditCount: 1 });
  });

  it("rejects STAFF before opening a transaction", async () => {
    const { deps } = dependencies();
    deps.requireAdmin = vi.fn(async () => { throw new AuthError("FORBIDDEN"); });
    await expect(unassignQrCode(input, deps)).resolves.toMatchObject({ code: "UNAUTHORIZED" });
    expect(deps.runTransaction).not.toHaveBeenCalled();
  });

  it("rejects blank or short reason before authorization", async () => {
    for (const reason of ["", "çok kısa"]) {
      const { deps } = dependencies();
      await expect(unassignQrCode({ ...input, reason }, deps)).resolves.toMatchObject({ code: "INVALID_INPUT" });
      expect(deps.requireAdmin).not.toHaveBeenCalled();
    }
  });

  it("trims reason and uses authenticated app user id", async () => {
    const { deps, transaction } = dependencies();
    await unassignQrCode({ ...input, reason: "  QR yanlış öğrenciye verildi  " }, deps);
    expect(transaction.writeAudit).toHaveBeenCalledWith(expect.objectContaining({
      actor: { type: "USER", userId: "admin_1" },
      reason: "QR yanlış öğrenciye verildi",
    }));
  });

  it("rejects a missing or mismatched assignment without audit", async () => {
    const { deps, transaction } = dependencies({ assignment: false });
    await expect(unassignQrCode(input, deps)).resolves.toMatchObject({ code: "ASSIGNMENT_NOT_FOUND" });
    expect(transaction.releaseQrCode).not.toHaveBeenCalled();
    expect(transaction.writeAudit).not.toHaveBeenCalled();
  });

  it.each([
    ["USED status", { status: QrCodeStatus.USED }, "QR_ALREADY_USED"],
    ["usedAt", { usedAt: new Date() }, "QR_ALREADY_USED"],
    ["registration", { hasRegistration: true }, "QR_HAS_REGISTRATION"],
    ["student match", { hasStudentMatch: true }, "QR_HAS_STUDENT_MATCH"],
    ["archive", { archivedAt: new Date() }, "QR_ARCHIVED"],
    ["disabled status", { status: QrCodeStatus.DISABLED }, "QR_DISABLED"],
    ["created status", { status: QrCodeStatus.CREATED }, "QR_NOT_UNASSIGNABLE"],
  ] as const)("rejects QR with %s without audit", async (_label, options, code) => {
    const { deps, transaction } = dependencies(options);
    await expect(unassignQrCode(input, deps)).resolves.toMatchObject({ code });
    expect(transaction.releaseQrCode).not.toHaveBeenCalled();
    expect(transaction.writeAudit).not.toHaveBeenCalled();
  });

  it("does not audit when either conditional update fails", async () => {
    for (const options of [{ releaseCount: 0 }, { detachCount: 0 }]) {
      const { deps, transaction } = dependencies(options);
      await expect(unassignQrCode(input, deps)).resolves.toMatchObject({ code: "UNASSIGNMENT_CONFLICT" });
      expect(transaction.writeAudit).not.toHaveBeenCalled();
    }
  });

  it("rolls QR and VR changes back when audit insert fails", async () => {
    const { deps, state } = dependencies({ auditError: true });
    await expect(unassignQrCode(input, deps)).resolves.toMatchObject({ code: "UNASSIGNMENT_FAILED" });
    expect(state).toEqual({ qrReleased: false, vrDetached: false, auditCount: 0 });
  });

  it("writes exact before and after operational fields", async () => {
    const { deps, transaction } = dependencies();
    await unassignQrCode(input, deps);
    expect(transaction.writeAudit).toHaveBeenCalledWith({
      actor: { type: "USER", userId: "admin_1" },
      action: AUDIT_ACTIONS.QR_ASSIGNMENT_REVERSED,
      entityType: AUDIT_ENTITY_TYPES.QR_CODE,
      entityId: "qr_1",
      relatedEntity: { type: AUDIT_ENTITY_TYPES.VR_RECORD, id: "vr_1" },
      reason: input.reason,
      beforeData: {
        status: QrCodeStatus.ASSIGNED,
        assignedAt: assignedAt.toISOString(),
        assignedQrCodeId: "qr_1",
      },
      afterData: {
        status: QrCodeStatus.CREATED,
        assignedAt: null,
        assignedQrCodeId: null,
      },
    });
    const payload = JSON.stringify(transaction.writeAudit.mock.calls[0][0]);
    expect(payload).not.toMatch(/token|tokenHash|serialNumber|firstName|lastName|phone|school/);
  });

  it("hides raw transaction failures", async () => {
    const result = await unassignQrCode(input, dependencies({ databaseError: true }).deps);
    expect(result).toMatchObject({ code: "UNASSIGNMENT_FAILED" });
    expect(JSON.stringify(result)).not.toContain("raw database secret");
  });
});
