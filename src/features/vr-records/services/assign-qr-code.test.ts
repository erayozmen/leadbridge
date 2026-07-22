import { QrCodeStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { AuthError } from "@/features/auth/types/auth";
import { assignQrCode, type AssignQrCodeDependencies } from "@/features/vr-records/services/assign-qr-code";

vi.mock("server-only", () => ({}));

type Options = {
  vrRecord?: { id: string; eventId?: string; assignedQrCodeId: string | null } | null;
  qrCode?: {
    id: string;
    eventId?: string;
    serialNumber: string;
    status: QrCodeStatus;
    archivedAt: Date | null;
    assigned: boolean;
  } | null;
  qrCount?: number;
  vrCount?: number;
  transactionError?: unknown;
};

function dependencies(options: Options = {}) {
  const transaction = {
    findVrRecord: vi.fn(async () => options.vrRecord === undefined ? { id: "vr_1", eventId: "event_1", assignedQrCodeId: null } : options.vrRecord),
    findQrCode: vi.fn(async () => options.qrCode === undefined ? {
      id: "qr_1",
      eventId: "event_1",
      serialNumber: "LB-000001",
      status: QrCodeStatus.CREATED,
      archivedAt: null,
      assigned: false,
    } : options.qrCode),
    claimQrCode: vi.fn(async () => options.qrCount ?? 1),
    attachQrToVrRecord: vi.fn(async () => options.vrCount ?? 1),
  };
  const deps: AssignQrCodeDependencies = {
    requireAdmin: vi.fn(async () => ({})),
    runTransaction: vi.fn(async (callback) => {
      if (options.transactionError) throw options.transactionError;
      return callback(transaction);
    }),
  };
  return { deps, transaction };
}

const input = { vrRecordId: "vr_1", qrCodeId: "qr_1" };

describe("assignQrCode", () => {
  it("allows ADMIN to assign a CREATED QR", async () => {
    await expect(assignQrCode(input, dependencies().deps)).resolves.toMatchObject({ ok: true, serialNumber: "LB-000001" });
  });
  it("rejects STAFF", async () => {
    const { deps } = dependencies();
    deps.requireAdmin = vi.fn(async () => { throw new AuthError("FORBIDDEN"); });
    await expect(assignQrCode(input, deps)).resolves.toMatchObject({ ok: false, code: "UNAUTHORIZED" });
  });
  it("rejects invalid ids before transaction", async () => {
    const { deps } = dependencies();
    await expect(assignQrCode({ vrRecordId: "", qrCodeId: "" }, deps)).resolves.toMatchObject({ ok: false, code: "INVALID_INPUT" });
    expect(deps.requireAdmin).not.toHaveBeenCalled();
  });
  it("returns VR_RECORD_NOT_FOUND", async () => {
    await expect(assignQrCode(input, dependencies({ vrRecord: null }).deps)).resolves.toMatchObject({ ok: false, code: "VR_RECORD_NOT_FOUND" });
  });
  it("returns QR_NOT_FOUND", async () => {
    await expect(assignQrCode(input, dependencies({ qrCode: null }).deps)).resolves.toMatchObject({ ok: false, code: "QR_NOT_FOUND" });
  });
  it("rejects a VR record that already has a QR", async () => {
    await expect(assignQrCode(input, dependencies({ vrRecord: { id: "vr_1", assignedQrCodeId: "qr_old" } }).deps)).resolves.toMatchObject({ ok: false, code: "VR_ALREADY_HAS_QR" });
  });
  it.each([QrCodeStatus.ASSIGNED, QrCodeStatus.USED, QrCodeStatus.DISABLED])("rejects a %s QR", async (status) => {
    const qrCode = {
      id: "qr_1",
      serialNumber: "LB-000001",
      status,
      archivedAt: null,
      assigned: status === QrCodeStatus.ASSIGNED,
    };
    await expect(assignQrCode(input, dependencies({ qrCode }).deps)).resolves.toMatchObject({ ok: false, code: "QR_NOT_AVAILABLE" });
  });
  it("rejects an archived CREATED QR", async () => {
    const qrCode = {
      id: "qr_1",
      serialNumber: "LB-000001",
      status: QrCodeStatus.CREATED,
      archivedAt: new Date(),
      assigned: false,
    };
    await expect(assignQrCode(input, dependencies({ qrCode }).deps)).resolves.toMatchObject({
      ok: false,
      code: "QR_NOT_AVAILABLE",
    });
  });
  it("updates QR and VR within the transaction", async () => {
    const { deps, transaction } = dependencies();
    await assignQrCode(input, deps);
    expect(transaction.claimQrCode).toHaveBeenCalledOnce();
    expect(transaction.attachQrToVrRecord).toHaveBeenCalledWith("vr_1", "qr_1");
  });
  it("rejects a QR from another event", async () => {
    const result = await assignQrCode(input, dependencies({
      vrRecord: { id: "vr_1", eventId: "event_1", assignedQrCodeId: null },
      qrCode: { id: "qr_1", eventId: "event_2", serialNumber: "LB-000001", status: QrCodeStatus.CREATED, archivedAt: null, assigned: false },
    }).deps);
    expect(result).toMatchObject({ ok: false, code: "QR_NOT_AVAILABLE" });
  });
  it("maps a failed QR conditional update to ASSIGNMENT_CONFLICT", async () => {
    await expect(assignQrCode(input, dependencies({ qrCount: 0 }).deps)).resolves.toMatchObject({ ok: false, code: "ASSIGNMENT_CONFLICT" });
  });
  it("maps a failed VR conditional update to ASSIGNMENT_CONFLICT", async () => {
    await expect(assignQrCode(input, dependencies({ vrCount: 0 }).deps)).resolves.toMatchObject({ ok: false, code: "ASSIGNMENT_CONFLICT" });
  });
  it("does not return success when the transaction fails", async () => {
    await expect(assignQrCode(input, dependencies({ transactionError: new Error("rollback") }).deps)).resolves.toMatchObject({ ok: false, code: "ASSIGN_FAILED" });
  });
  it("does not leak raw Prisma errors", async () => {
    const result = await assignQrCode(input, dependencies({ transactionError: new Error("sensitive database details") }).deps);
    expect(JSON.stringify(result)).not.toContain("sensitive database details");
  });
});
