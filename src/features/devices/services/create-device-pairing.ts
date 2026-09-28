import "server-only";

import { DeviceStatus, DeviceTokenKind, EventStatus } from "@prisma/client";

import { AUDIT_ACTIONS } from "@/features/audit/constants/audit-actions";
import { AUDIT_ENTITY_TYPES } from "@/features/audit/constants/audit-entity-types";
import { writeAuditLog } from "@/features/audit/services/write-audit-log";
import { requireStaffOrAdmin } from "@/features/auth/server/auth";
import {
  PAIRING_CODE_TTL_MS,
  generatePairingCode,
  hashDeviceToken,
  normalizePairingCode,
} from "@/features/devices/lib/device-token";
import { createDevicePairingSchema } from "@/features/devices/schemas/device-schemas";
import { prisma } from "@/lib/prisma";

export type CreateDevicePairingResult = {
  deviceId: string;
  /** Shown once to the staff member; only its hash is stored. */
  pairingCode: string;
  expiresAt: Date;
};

/** Registers a new headset and issues a single-use, short-lived pairing code for it. */
export async function createDevicePairing(input: unknown, now = new Date()): Promise<CreateDevicePairingResult> {
  const data = createDevicePairingSchema.parse(input);
  const actor = await requireStaffOrAdmin();
  const pairingCode = generatePairingCode();
  const expiresAt = new Date(now.getTime() + PAIRING_CODE_TTL_MS);

  return prisma.$transaction(async (tx) => {
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
    await tx.deviceToken.create({
      data: {
        deviceId: device.id,
        kind: DeviceTokenKind.PAIRING,
        tokenHash: hashDeviceToken(normalizePairingCode(pairingCode)!),
        expiresAt,
      },
      select: { id: true },
    });
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
