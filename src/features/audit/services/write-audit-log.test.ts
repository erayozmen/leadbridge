import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { AUDIT_ACTIONS } from "@/features/audit/constants/audit-actions";
import { AUDIT_ENTITY_TYPES } from "@/features/audit/constants/audit-entity-types";
import {
  type AuditTransactionClient,
  writeAuditLog,
} from "@/features/audit/services/write-audit-log";
import type { WriteAuditLogInput } from "@/features/audit/types/audit-log";

vi.mock("server-only", () => ({}));

const createdAt = new Date("2026-07-20T18:00:00.000Z");

function input(): WriteAuditLogInput {
  return {
    actor: { type: "USER", userId: "user_1" },
    action: AUDIT_ACTIONS.STUDENT_MATCH_REMOVED,
    entityType: AUDIT_ENTITY_TYPES.STUDENT_MATCH,
    entityId: "match_1",
    relatedEntity: { type: AUDIT_ENTITY_TYPES.VR_RECORD, id: "vr_1" },
    reason: "  Yanlış kayıtlar eşleştirildi  ",
    beforeData: {
      vrRecordId: "vr_1",
      qrRegistrationId: "registration_1",
    },
    metadata: { source: "ADMIN_CORRECTION" },
    correlationId: "request_1",
  };
}

function transaction(error?: Error) {
  const create = vi.fn(async () => {
    if (error) throw error;
    return { id: "audit_1", createdAt };
  });
  return {
    create,
    tx: { auditLog: { create } } as unknown as AuditTransactionClient,
  };
}

describe("writeAuditLog", () => {
  it("writes only validated safe fields through the supplied delegate", async () => {
    const { tx, create } = transaction();
    await writeAuditLog(tx, input());

    expect(create).toHaveBeenCalledWith({
      data: {
        actorUserId: "user_1",
        actorType: "USER",
        action: AUDIT_ACTIONS.STUDENT_MATCH_REMOVED,
        entityType: AUDIT_ENTITY_TYPES.STUDENT_MATCH,
        entityId: "match_1",
        relatedEntityType: AUDIT_ENTITY_TYPES.VR_RECORD,
        relatedEntityId: "vr_1",
        reason: "Yanlış kayıtlar eşleştirildi",
        beforeData: {
          vrRecordId: "vr_1",
          qrRegistrationId: "registration_1",
        },
        metadata: { source: "ADMIN_CORRECTION" },
        correlationId: "request_1",
      },
      select: { id: true, createdAt: true },
    });
  });

  it("omits related entity, reason and JSON columns when absent", async () => {
    const { tx, create } = transaction();
    await writeAuditLog(tx, {
      actor: { type: "SYSTEM", userId: null },
      action: AUDIT_ACTIONS.ATTENDANCE_MARKED,
      entityType: AUDIT_ENTITY_TYPES.QR_REGISTRATION,
      entityId: "registration_1",
    });

    const data = create.mock.calls[0][0].data;
    expect(data).toEqual({
      actorUserId: null,
      actorType: "SYSTEM",
      action: AUDIT_ACTIONS.ATTENDANCE_MARKED,
      entityType: AUDIT_ENTITY_TYPES.QR_REGISTRATION,
      entityId: "registration_1",
    });
    expect(data).not.toHaveProperty("beforeData");
    expect(data).not.toHaveProperty("relatedEntityType");
  });

  it("uses Prisma JsonNull only for an explicit top-level JSON null", async () => {
    const { tx, create } = transaction();
    await writeAuditLog(tx, {
      actor: { type: "USER", userId: "user_1" },
      action: AUDIT_ACTIONS.ATTENDANCE_MARKED,
      entityType: AUDIT_ENTITY_TYPES.QR_REGISTRATION,
      entityId: "registration_1",
      afterData: null,
    });

    expect(create.mock.calls[0][0].data.afterData).toBe(Prisma.JsonNull);
  });

  it("returns only id and createdAt", async () => {
    const { tx } = transaction();
    await expect(writeAuditLog(tx, input())).resolves.toEqual({
      id: "audit_1",
      createdAt,
    });
  });

  it("does not call create when validation fails", async () => {
    const { tx, create } = transaction();
    await expect(
      writeAuditLog(tx, { ...input(), action: "UNKNOWN" } as never),
    ).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
  });

  it("does not serialize raw request or Error objects", async () => {
    const { tx, create } = transaction();
    await expect(
      writeAuditLog(tx, {
        ...input(),
        metadata: new Error("private database detail"),
      } as never),
    ).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
  });

  it("does not swallow Prisma delegate failures", async () => {
    const databaseError = new Error("database insert failed");
    const { tx } = transaction(databaseError);
    await expect(writeAuditLog(tx, input())).rejects.toBe(databaseError);
  });

  it("requires no global Prisma client or transaction method", async () => {
    const { tx, create } = transaction();
    expect(Object.keys(tx)).toEqual(["auditLog"]);
    await writeAuditLog(tx, input());
    expect(create).toHaveBeenCalledOnce();
  });
});
