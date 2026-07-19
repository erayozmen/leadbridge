import { QrCodeStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { AuthError } from "@/features/auth/types/auth";
import {
  unassignQrCode,
  type UnassignQrCodeDependencies,
} from "@/features/vr-records/services/unassign-qr-code";

vi.mock("server-only", () => ({}));

type State = {
  status?: QrCodeStatus;
  usedAt?: Date | null;
  archivedAt?: Date | null;
  hasRegistration?: boolean;
  hasStudentMatch?: boolean;
  assignment?: boolean;
  detachCount?: number;
  releaseCount?: number;
  error?: boolean;
};

function dependencies(state: State = {}) {
  const transaction = {
    findAssignment: vi.fn(async (vrRecordId: string, qrCodeId: string) => {
      if (state.error) throw new Error("raw database secret");
      if (state.assignment === false || vrRecordId !== "vr_1" || qrCodeId !== "qr_1") return null;
      return {
        vrRecordId: "vr_1",
        assignedQrCodeId: "qr_1",
        hasStudentMatch: state.hasStudentMatch ?? false,
        qrCode: {
          id: "qr_1",
          serialNumber: "LB-000001",
          status: state.status ?? QrCodeStatus.ASSIGNED,
          usedAt: state.usedAt ?? null,
          archivedAt: state.archivedAt ?? null,
          hasRegistration: state.hasRegistration ?? false,
        },
      };
    }),
    detachQrFromVrRecord: vi.fn(async () => state.detachCount ?? 1),
    releaseQrCode: vi.fn(async () => state.releaseCount ?? 1),
  };
  const deps: UnassignQrCodeDependencies = {
    requireAdmin: vi.fn(async () => ({})),
    runTransaction: vi.fn(async (callback) => callback(transaction)),
  };
  return { deps, transaction };
}

const input = { vrRecordId: "vr_1", qrCodeId: "qr_1" };

describe("unassignQrCode", () => {
  it("allows ADMIN to release an unused assigned QR", async () => {
    await expect(unassignQrCode(input, dependencies().deps)).resolves.toEqual({
      ok: true,
      serialNumber: "LB-000001",
    });
  });

  it("rejects STAFF before opening a transaction", async () => {
    const { deps } = dependencies();
    deps.requireAdmin = vi.fn(async () => { throw new AuthError("FORBIDDEN"); });
    await expect(unassignQrCode(input, deps)).resolves.toMatchObject({ code: "UNAUTHORIZED" });
    expect(deps.runTransaction).not.toHaveBeenCalled();
  });

  it("rejects invalid ids before authorization", async () => {
    const { deps } = dependencies();
    await expect(unassignQrCode({ vrRecordId: "", qrCodeId: "qr_1" }, deps)).resolves.toMatchObject({ code: "INVALID_INPUT" });
    expect(deps.requireAdmin).not.toHaveBeenCalled();
  });

  it("rejects a missing or mismatched assignment", async () => {
    const { deps, transaction } = dependencies({ assignment: false });
    await expect(unassignQrCode(input, deps)).resolves.toMatchObject({ code: "ASSIGNMENT_NOT_FOUND" });
    expect(transaction.detachQrFromVrRecord).not.toHaveBeenCalled();
  });

  it.each([
    ["USED status", { status: QrCodeStatus.USED }, "QR_ALREADY_USED"],
    ["usedAt", { usedAt: new Date() }, "QR_ALREADY_USED"],
    ["registration", { hasRegistration: true }, "QR_HAS_REGISTRATION"],
    ["student match", { hasStudentMatch: true }, "QR_HAS_STUDENT_MATCH"],
    ["archive", { archivedAt: new Date() }, "QR_ARCHIVED"],
    ["disabled status", { status: QrCodeStatus.DISABLED }, "QR_DISABLED"],
    ["created status", { status: QrCodeStatus.CREATED }, "QR_NOT_UNASSIGNABLE"],
  ] as const)("rejects QR with %s", async (_label, state, code) => {
    const { deps, transaction } = dependencies(state);
    await expect(unassignQrCode(input, deps)).resolves.toMatchObject({ code });
    expect(transaction.detachQrFromVrRecord).not.toHaveBeenCalled();
    expect(transaction.releaseQrCode).not.toHaveBeenCalled();
  });

  it("updates only the requested VR and QR assignment fields", async () => {
    const { deps, transaction } = dependencies();
    await unassignQrCode(input, deps);
    expect(transaction.detachQrFromVrRecord).toHaveBeenCalledWith("vr_1", "qr_1");
    expect(transaction.releaseQrCode).toHaveBeenCalledWith("qr_1", "vr_1");
    expect(transaction.releaseQrCode.mock.invocationCallOrder[0]).toBeLessThan(
      transaction.detachQrFromVrRecord.mock.invocationCallOrder[0],
    );
    expect(Object.keys(transaction)).toEqual(["findAssignment", "detachQrFromVrRecord", "releaseQrCode"]);
  });

  it.each([
    [{ releaseCount: 0 }, "detachQrFromVrRecord"],
    [{ detachCount: 0 }, null],
  ] as const)("returns conflict for conditional update failure", async (state, untouchedMethod) => {
    const { deps, transaction } = dependencies(state);
    await expect(unassignQrCode(input, deps)).resolves.toMatchObject({ code: "UNASSIGNMENT_CONFLICT" });
    if (untouchedMethod) expect(transaction[untouchedMethod]).not.toHaveBeenCalled();
  });

  it("hides raw transaction failures", async () => {
    const result = await unassignQrCode(input, dependencies({ error: true }).deps);
    expect(result).toMatchObject({ code: "UNASSIGNMENT_FAILED" });
    expect(JSON.stringify(result)).not.toContain("raw database secret");
  });
});
