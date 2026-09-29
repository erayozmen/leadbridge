import "server-only";

import { DeviceStatus } from "@prisma/client";
import { z } from "zod";

import { AUDIT_ACTIONS } from "@/features/audit/constants/audit-actions";
import { AUDIT_ENTITY_TYPES } from "@/features/audit/constants/audit-entity-types";
import { writeAuditLog } from "@/features/audit/services/write-audit-log";
import { requireStaffOrAdmin } from "@/features/auth/server/auth";
import { DeviceError } from "@/features/devices/services/device-errors";
import {
  issuePairingCode,
  lockDevice,
  revokeDeviceTokens,
  type IssuedPairingCode,
} from "@/features/devices/services/pairing-code";
import { prisma } from "@/lib/prisma";

const deviceIdSchema = z.object({ deviceId: z.string().trim().min(1).max(64) }).strict();

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function loadLockedDevice(tx: TransactionClient, deviceId: string) {
  await lockDevice(tx, deviceId);
  const device = await tx.device.findUnique({ where: { id: deviceId }, select: { id: true, name: true, status: true } });
  if (!device) throw new DeviceError("DEVICE_NOT_FOUND");
  return device;
}

export type RenewDevicePairingResult = IssuedPairingCode & { deviceId: string };

/**
 * Issues a new pairing code for an existing PENDING device, or re-opens pairing for a DISABLED one.
 * Every earlier code and access token of the device stops working immediately.
 */
export async function renewDevicePairing(input: unknown, now = new Date()): Promise<RenewDevicePairingResult> {
  const { deviceId } = deviceIdSchema.parse(input);
  const actor = await requireStaffOrAdmin();

  return prisma.$transaction(async (tx) => {
    const device = await loadLockedDevice(tx, deviceId);
    if (device.status === DeviceStatus.ACTIVE) throw new DeviceError("DEVICE_STATE_CONFLICT");

    const revokedTokenCount = await revokeDeviceTokens(tx, deviceId, now);
    if (device.status === DeviceStatus.DISABLED) {
      await tx.device.update({ where: { id: deviceId }, data: { status: DeviceStatus.PENDING }, select: { id: true } });
    }
    const issued = await issuePairingCode(tx, deviceId, now);
    await writeAuditLog(tx, {
      actor: { type: "USER", userId: actor.id },
      action: AUDIT_ACTIONS.DEVICE_PAIRING_RENEWED,
      entityType: AUDIT_ENTITY_TYPES.DEVICE,
      entityId: deviceId,
      beforeData: { status: device.status },
      afterData: { status: DeviceStatus.PENDING, expiresAt: issued.expiresAt.toISOString() },
      metadata: { revokedTokenCount },
    });

    return { deviceId, ...issued };
  });
}

/** Removes a device that was never activated; its tokens are deleted with it. */
export async function cancelDevicePairing(input: unknown): Promise<{ deviceId: string }> {
  const { deviceId } = deviceIdSchema.parse(input);
  const actor = await requireStaffOrAdmin();

  return prisma.$transaction(async (tx) => {
    const device = await loadLockedDevice(tx, deviceId);
    if (device.status !== DeviceStatus.PENDING) throw new DeviceError("DEVICE_STATE_CONFLICT");

    await tx.device.delete({ where: { id: deviceId }, select: { id: true } });
    await writeAuditLog(tx, {
      actor: { type: "USER", userId: actor.id },
      action: AUDIT_ACTIONS.DEVICE_PAIRING_CANCELLED,
      entityType: AUDIT_ENTITY_TYPES.DEVICE,
      entityId: deviceId,
      beforeData: { name: device.name, status: device.status },
      afterData: null,
    });

    return { deviceId };
  });
}

/** Disables an active device and revokes its tokens; its next heartbeat is rejected with 403. */
export async function disableDevice(input: unknown, now = new Date()): Promise<{ deviceId: string }> {
  const { deviceId } = deviceIdSchema.parse(input);
  const actor = await requireStaffOrAdmin();

  return prisma.$transaction(async (tx) => {
    const device = await loadLockedDevice(tx, deviceId);
    if (device.status !== DeviceStatus.ACTIVE) throw new DeviceError("DEVICE_STATE_CONFLICT");

    await tx.device.update({ where: { id: deviceId }, data: { status: DeviceStatus.DISABLED }, select: { id: true } });
    const revokedTokenCount = await revokeDeviceTokens(tx, deviceId, now);
    await writeAuditLog(tx, {
      actor: { type: "USER", userId: actor.id },
      action: AUDIT_ACTIONS.DEVICE_DISABLED,
      entityType: AUDIT_ENTITY_TYPES.DEVICE,
      entityId: deviceId,
      beforeData: { status: DeviceStatus.ACTIVE },
      afterData: { status: DeviceStatus.DISABLED },
      metadata: { revokedTokenCount },
    });

    return { deviceId };
  });
}
