import "server-only";

import { DeviceStatus, EventStatus } from "@prisma/client";

import { AUDIT_ACTIONS } from "@/features/audit/constants/audit-actions";
import { AUDIT_ENTITY_TYPES } from "@/features/audit/constants/audit-entity-types";
import { writeAuditLog } from "@/features/audit/services/write-audit-log";
import { requireStaffOrAdmin } from "@/features/auth/server/auth";
import { createDevicePairingSchema } from "@/features/devices/schemas/device-schemas";
import { DeviceError } from "@/features/devices/services/device-errors";
import { issuePairingCode } from "@/features/devices/services/pairing-code";
import { prisma } from "@/lib/prisma";

export type CreateDevicePairingResult = {
  deviceId: string;
  /** Shown once to the staff member; only its hash is stored. */
  pairingCode: string;
  expiresAt: Date;
};

/**
 * Registers a new headset and issues a single-use pairing code for it.
 * A name already used by a PENDING or ACTIVE device is rejected; renew that device's code instead.
 */
export async function createDevicePairing(input: unknown, now = new Date()): Promise<CreateDevicePairingResult> {
  const data = createDevicePairingSchema.parse(input);
  const actor = await requireStaffOrAdmin();

  return prisma.$transaction(async (tx) => {
    // Serializes creations with the same (case-insensitive) name so duplicates cannot race in.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${data.name.toLowerCase()}))`;
    const existing = await tx.device.findFirst({
      where: {
        name: { equals: data.name, mode: "insensitive" },
        status: { in: [DeviceStatus.PENDING, DeviceStatus.ACTIVE] },
      },
      select: { id: true },
    });
    if (existing) throw new DeviceError("DEVICE_NAME_IN_USE");

    if (data.eventId) {
      const event = await tx.event.findUnique({ where: { id: data.eventId }, select: { status: true } });
      if (!event || event.status === EventStatus.ARCHIVED) throw new Error("EVENT_NOT_ASSIGNABLE");
    }

    const device = await tx.device.create({
      data: {
        name: data.name,
        eventId: data.eventId ?? null,
        status: DeviceStatus.PENDING,
        createdByUserId: actor.id,
      },
      select: { id: true },
    });
    const { pairingCode, expiresAt } = await issuePairingCode(tx, device.id, now);
    await writeAuditLog(tx, {
      actor: { type: "USER", userId: actor.id },
      action: AUDIT_ACTIONS.DEVICE_PAIRING_CREATED,
      entityType: AUDIT_ENTITY_TYPES.DEVICE,
      entityId: device.id,
      ...(data.eventId ? { relatedEntity: { type: AUDIT_ENTITY_TYPES.EVENT, id: data.eventId } } : {}),
      afterData: { name: data.name, status: DeviceStatus.PENDING, expiresAt: expiresAt.toISOString() },
    });

    return { deviceId: device.id, pairingCode, expiresAt };
  });
}
