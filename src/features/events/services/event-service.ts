import "server-only";
import { EventStatus } from "@prisma/client";
import { z } from "zod";
import { AUDIT_ACTIONS } from "@/features/audit/constants/audit-actions";
import { AUDIT_ENTITY_TYPES } from "@/features/audit/constants/audit-entity-types";
import { validateAuditReason } from "@/features/audit/lib/validate-audit-input";
import { writeAuditLog } from "@/features/audit/services/write-audit-log";
import { requireAdmin } from "@/features/auth/server/auth";
import { prisma } from "@/lib/prisma";

const fields = z
  .object({
    name: z.string().trim().min(2).max(120),
    eventDate: z.coerce.date(),
    location: z.string().trim().min(2).max(160),
  })
  .strict();
const transitions: Record<EventStatus, EventStatus | undefined> = {
  DRAFT: EventStatus.ACTIVE,
  ACTIVE: EventStatus.COMPLETED,
  COMPLETED: EventStatus.ARCHIVED,
  ARCHIVED: undefined,
};
export function isEventTransitionAllowed(
  current: EventStatus,
  next: EventStatus,
) {
  return transitions[current] === next;
}
export async function createEvent(input: unknown) {
  const data = fields.parse(input);
  const actor = await requireAdmin();
  return prisma.$transaction(async (tx) => {
    const event = await tx.event.create({
      data: { ...data, status: EventStatus.DRAFT },
      select: { id: true },
    });
    await writeAuditLog(tx, {
      actor: { type: "USER", userId: actor.id },
      action: AUDIT_ACTIONS.EVENT_CREATED,
      entityType: AUDIT_ENTITY_TYPES.EVENT,
      entityId: event.id,
      afterData: {
        status: EventStatus.DRAFT,
        eventDate: data.eventDate.toISOString(),
        location: data.location,
      },
    });
    return event;
  });
}
export async function updateEvent(id: string, input: unknown) {
  const data = fields.parse(input),
    actor = await requireAdmin();
  return prisma.$transaction(async (tx) => {
    const current = await tx.event.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        eventDate: true,
        location: true,
        status: true,
      },
    });
    if (!current || current.status === EventStatus.ARCHIVED)
      throw new Error("EVENT_NOT_EDITABLE");
    const event = await tx.event.update({
      where: { id },
      data,
      select: { id: true },
    });
    await writeAuditLog(tx, {
      actor: { type: "USER", userId: actor.id },
      action: AUDIT_ACTIONS.EVENT_UPDATED,
      entityType: AUDIT_ENTITY_TYPES.EVENT,
      entityId: id,
      beforeData: {
        name: current.name,
        eventDate: current.eventDate.toISOString(),
        location: current.location,
      },
      afterData: {
        name: data.name,
        eventDate: data.eventDate.toISOString(),
        location: data.location,
      },
    });
    return event;
  });
}
export async function advanceEventStatus(
  id: string,
  nextStatus: EventStatus,
  rawReason: unknown,
) {
  const reason = validateAuditReason(
      AUDIT_ACTIONS.EVENT_STATUS_CHANGED,
      rawReason,
    ) as string,
    actor = await requireAdmin();
  return prisma.$transaction(async (tx) => {
    const current = await tx.event.findUnique({
      where: { id },
      select: { id: true, name: true, status: true },
    });
    if (!current || !isEventTransitionAllowed(current.status, nextStatus))
      throw new Error("INVALID_EVENT_TRANSITION");
    if (nextStatus === EventStatus.ACTIVE) {
      const activeCount = await tx.event.count({
        where: { status: EventStatus.ACTIVE, id: { not: id } },
      });
      if (activeCount > 0) throw new Error("ACTIVE_EVENT_EXISTS");
    }
    const updated = await tx.event.update({
      where: { id, status: current.status },
      data: { status: nextStatus },
      select: { id: true, name: true, status: true },
    });
    await writeAuditLog(tx, {
      actor: { type: "USER", userId: actor.id },
      action: AUDIT_ACTIONS.EVENT_STATUS_CHANGED,
      entityType: AUDIT_ENTITY_TYPES.EVENT,
      entityId: id,
      reason,
      beforeData: { status: current.status },
      afterData: { status: nextStatus },
    });
    return updated;
  }, { isolationLevel: "Serializable" });
}
