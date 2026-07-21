"use server";

import { EventStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AUDIT_ACTIONS } from "@/features/audit/constants/audit-actions";
import { AUDIT_ENTITY_TYPES } from "@/features/audit/constants/audit-entity-types";
import { writeAuditLog } from "@/features/audit/services/write-audit-log";
import { requireAdmin } from "@/features/auth/server/auth";
import { setActiveEventCookie } from "@/features/events/server/active-event";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({ name: z.string().trim().min(2).max(120), eventDate: z.coerce.date(), location: z.string().trim().min(2).max(160) });
const value = (data: FormData, key: string) => typeof data.get(key) === "string" ? String(data.get(key)) : "";

export async function createEventAction(data: FormData) {
  const admin = await requireAdmin();
  const parsed = createSchema.safeParse({ name: value(data,"name"), eventDate: value(data,"eventDate"), location: value(data,"location") });
  if (!parsed.success) return;
  await prisma.$transaction(async tx => {
    const event = await tx.event.create({ data: { ...parsed.data, status: EventStatus.DRAFT }, select: { id: true } });
    await writeAuditLog(tx, { actor: { type: "USER", userId: admin.id }, action: AUDIT_ACTIONS.EVENT_CREATED, entityType: AUDIT_ENTITY_TYPES.EVENT, entityId: event.id, afterData: { status: EventStatus.DRAFT } });
  });
  revalidatePath("/dashboard/events");
}

export async function changeEventStatusAction(data: FormData) {
  const admin = await requireAdmin();
  const id = value(data,"eventId"), status = value(data,"status");
  if (!id || !Object.values(EventStatus).includes(status as EventStatus)) return;
  const nextStatus = status as EventStatus;
  await prisma.$transaction(async tx => {
    const current = await tx.event.findUnique({ where: { id }, select: { status: true } });
    if (!current) return;
    await tx.event.update({ where: { id }, data: { status: nextStatus } });
    await writeAuditLog(tx, { actor: { type: "USER", userId: admin.id }, action: AUDIT_ACTIONS.EVENT_STATUS_CHANGED, entityType: AUDIT_ENTITY_TYPES.EVENT, entityId: id, beforeData: { status: current.status }, afterData: { status: nextStatus } });
  });
  revalidatePath("/dashboard/events");
}

export async function selectActiveEventAction(data: FormData) {
  await requireAdmin();
  const id = value(data,"eventId");
  const event = await prisma.event.findFirst({ where: { id, status: EventStatus.ACTIVE }, select: { id: true } });
  if (!event) return;
  await setActiveEventCookie(event.id);
  revalidatePath("/dashboard", "layout");
}
