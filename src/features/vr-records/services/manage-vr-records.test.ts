import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireAdmin, writeAuditLog, transaction, tx } = vi.hoisted(() => {
  const tx = {
    event: { findFirst: vi.fn() },
    vrRecord: { findMany: vi.fn(), deleteMany: vi.fn(), updateMany: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  return {
    requireAdmin: vi.fn(async () => ({ id: "admin_1" })),
    writeAuditLog: vi.fn(async () => ({ id: "audit_1", createdAt: new Date() })),
    transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    tx,
  };
});

vi.mock("server-only", () => ({}));
vi.mock("@/features/auth/server/auth", () => ({ requireAdmin }));
vi.mock("@/features/audit/services/write-audit-log", () => ({ writeAuditLog }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: transaction } }));

import { assignVrRecordsToEvent, deleteVrRecords } from "@/features/vr-records/services/manage-vr-records";

describe("VR record management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdmin.mockResolvedValue({ id: "admin_1" });
  });

  it("deletes one or more unlinked records and audits each deletion", async () => {
    tx.vrRecord.findMany.mockResolvedValue([
      { id: "vr_1", eventId: "event_1", assignedQrCodeId: null, studentMatch: null },
      { id: "vr_2", eventId: "event_1", assignedQrCodeId: null, studentMatch: null },
    ]);
    tx.vrRecord.deleteMany.mockResolvedValue({ count: 2 });
    await expect(deleteVrRecords(["vr_1", "vr_2"], "Yanlış kayıtlar oluşturuldu")).resolves.toEqual({ ok: true, count: 2 });
    expect(tx.vrRecord.deleteMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ assignedQrCodeId: null }) }));
    expect(writeAuditLog).toHaveBeenCalledTimes(2);
  });

  it("does not delete a record with a QR or student match", async () => {
    tx.vrRecord.findMany.mockResolvedValue([{ id: "vr_1", eventId: "event_1", assignedQrCodeId: "qr_1", studentMatch: null }]);
    await expect(deleteVrRecords(["vr_1"], "Yanlış kayıt oluşturuldu")).resolves.toMatchObject({ ok: false });
    expect(tx.vrRecord.deleteMany).not.toHaveBeenCalled();
    expect(writeAuditLog).not.toHaveBeenCalled();
  });

  it("moves only unlinked records to an existing operational event", async () => {
    tx.event.findFirst.mockResolvedValue({ id: "event_2" });
    tx.vrRecord.findMany.mockResolvedValue([{ id: "vr_1", eventId: "event_1", assignedQrCodeId: null, studentMatch: null }]);
    tx.vrRecord.updateMany.mockResolvedValue({ count: 1 });
    await expect(assignVrRecordsToEvent(["vr_1"], "event_2", "Etkinlik ataması düzeltildi")).resolves.toEqual({ ok: true, count: 1 });
    expect(writeAuditLog).toHaveBeenCalledWith(tx, expect.objectContaining({ entityId: "vr_1", beforeData: { eventId: "event_1" }, afterData: { eventId: "event_2" } }));
  });
});
