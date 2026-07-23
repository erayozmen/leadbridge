import "server-only";

import { AUDIT_ACTIONS } from "@/features/audit/constants/audit-actions";
import { AUDIT_ENTITY_TYPES } from "@/features/audit/constants/audit-entity-types";
import { validateAuditReason } from "@/features/audit/lib/validate-audit-input";
import { writeAuditLog } from "@/features/audit/services/write-audit-log";
import { requireAdmin } from "@/features/auth/server/auth";
import { prisma } from "@/lib/prisma";

const normalizeIds = (ids: unknown) => Array.isArray(ids)
  ? [...new Set(ids.filter((id): id is string => typeof id === "string").map((id) => id.trim()).filter(Boolean))].slice(0, 100)
  : [];

export type ManageVrRecordsResult = { ok: true; count: number } | { ok: false; message: string };

export async function deleteVrRecords(idsInput: unknown, rawReason: unknown): Promise<ManageVrRecordsResult> {
  const actor = await requireAdmin();
  const ids = normalizeIds(idsInput);
  if (!ids.length) return { ok: false, message: "En az bir VR kaydı seçin." };
  const reason = validateAuditReason(AUDIT_ACTIONS.VR_RECORD_DELETED, rawReason) as string;
  try {
    return await prisma.$transaction(async (tx) => {
      const records = await tx.vrRecord.findMany({ where: { id: { in: ids } }, select: { id: true, eventId: true, assignedQrCodeId: true, studentMatch: { select: { id: true } } } });
      if (records.length !== ids.length || records.some((record) => record.assignedQrCodeId || record.studentMatch)) throw new Error("VR_RECORD_LINKED");
      const deleted = await tx.vrRecord.deleteMany({ where: { id: { in: ids }, assignedQrCodeId: null, studentMatch: { is: null } } });
      if (deleted.count !== ids.length) throw new Error("VR_RECORD_CONFLICT");
      for (const record of records) await writeAuditLog(tx, { actor: { type: "USER", userId: actor.id }, action: AUDIT_ACTIONS.VR_RECORD_DELETED, entityType: AUDIT_ENTITY_TYPES.VR_RECORD, entityId: record.id, reason, beforeData: { eventId: record.eventId } });
      return { ok: true as const, count: deleted.count };
    });
  } catch {
    return { ok: false, message: "Bağlı QR veya eşleşmesi bulunan VR kayıtları silinemez." };
  }
}

export async function assignVrRecordsToEvent(idsInput: unknown, eventIdInput: unknown, rawReason: unknown): Promise<ManageVrRecordsResult> {
  const actor = await requireAdmin();
  const ids = normalizeIds(idsInput);
  const eventId = typeof eventIdInput === "string" ? eventIdInput.trim() : "";
  if (!ids.length || !eventId) return { ok: false, message: "Kayıtları ve hedef etkinliği seçin." };
  const reason = validateAuditReason(AUDIT_ACTIONS.VR_RECORD_EVENT_ASSIGNED, rawReason) as string;
  try {
    return await prisma.$transaction(async (tx) => {
      const [event, records] = await Promise.all([
        tx.event.findFirst({ where: { id: eventId, status: { in: ["DRAFT", "ACTIVE"] } }, select: { id: true } }),
        tx.vrRecord.findMany({ where: { id: { in: ids } }, select: { id: true, eventId: true, assignedQrCodeId: true, studentMatch: { select: { id: true } } } }),
      ]);
      if (!event || records.length !== ids.length || records.some((record) => record.assignedQrCodeId || record.studentMatch)) throw new Error("VR_RECORD_NOT_MOVABLE");
      const changed = records.filter((record) => record.eventId !== eventId);
      const updated = await tx.vrRecord.updateMany({ where: { id: { in: changed.map((record) => record.id) }, assignedQrCodeId: null, studentMatch: { is: null } }, data: { eventId } });
      if (updated.count !== changed.length) throw new Error("VR_RECORD_CONFLICT");
      for (const record of changed) await writeAuditLog(tx, { actor: { type: "USER", userId: actor.id }, action: AUDIT_ACTIONS.VR_RECORD_EVENT_ASSIGNED, entityType: AUDIT_ENTITY_TYPES.VR_RECORD, entityId: record.id, relatedEntity: { type: AUDIT_ENTITY_TYPES.EVENT, id: eventId }, reason, beforeData: { eventId: record.eventId }, afterData: { eventId } });
      return { ok: true as const, count: updated.count };
    });
  } catch {
    return { ok: false, message: "Bağlı QR veya eşleşmesi bulunan kayıtlar başka etkinliğe taşınamaz." };
  }
}
