import "server-only";

import { DeviceStatus, DeviceTokenKind } from "@prisma/client";

import { AUDIT_ACTIONS } from "@/features/audit/constants/audit-actions";
import { AUDIT_ENTITY_TYPES } from "@/features/audit/constants/audit-entity-types";
import { writeAuditLog } from "@/features/audit/services/write-audit-log";
import {
  generateDeviceAccessToken,
  hashDeviceToken,
  normalizePairingCode,
} from "@/features/devices/lib/device-token";
import { pairDeviceSchema } from "@/features/devices/schemas/device-schemas";
import { DeviceError } from "@/features/devices/services/device-errors";
import { prisma } from "@/lib/prisma";

export type PairDeviceResult = {
  deviceId: string;
  /** Name stored on the Device: the one sent by the headset, otherwise the dashboard name. */
  deviceName: string;
  /** Returned to the headset exactly once; only its hash is stored. */
  accessToken: string;
};

/** Exchanges a single-use pairing code for a long-lived device access token. */
export async function pairDevice(input: unknown, now = new Date()): Promise<PairDeviceResult> {
  const data = pairDeviceSchema.parse(input);
  const pairingCode = normalizePairingCode(data.pairingCode);
  if (!pairingCode) throw new DeviceError("INVALID_PAIRING_CODE");

  const accessToken = generateDeviceAccessToken();

  return prisma.$transaction(async (tx) => {
    const pairing = await tx.deviceToken.findUnique({
      where: { tokenHash: hashDeviceToken(pairingCode) },
      select: {
        id: true,
        kind: true,
        usedAt: true,
        revokedAt: true,
        expiresAt: true,
        device: { select: { id: true, status: true } },
      },
    });
    if (
      !pairing ||
      pairing.kind !== DeviceTokenKind.PAIRING ||
      pairing.usedAt ||
      pairing.revokedAt ||
      !pairing.expiresAt ||
      pairing.expiresAt <= now ||
      pairing.device.status === DeviceStatus.DISABLED
    ) {
      throw new DeviceError("INVALID_PAIRING_CODE");
    }

    // Conditional update makes the code single-use even under concurrent requests.
    const consumed = await tx.deviceToken.updateMany({
      where: { id: pairing.id, usedAt: null, revokedAt: null },
      data: { usedAt: now },
    });
    if (consumed.count !== 1) throw new DeviceError("INVALID_PAIRING_CODE");

    const deviceId = pairing.device.id;
    if (data.serialNumber) {
      const owner = await tx.device.findUnique({ where: { serialNumber: data.serialNumber }, select: { id: true } });
      if (owner && owner.id !== deviceId) throw new DeviceError("SERIAL_NUMBER_IN_USE");
    }

    // Re-pairing replaces any access token the device held before.
    await tx.deviceToken.updateMany({
      where: { deviceId, kind: DeviceTokenKind.ACCESS, revokedAt: null },
      data: { revokedAt: now },
    });
    await tx.deviceToken.create({
      data: { deviceId, kind: DeviceTokenKind.ACCESS, tokenHash: hashDeviceToken(accessToken) },
      select: { id: true },
    });
    const device = await tx.device.update({
      where: { id: deviceId },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.serialNumber ? { serialNumber: data.serialNumber } : {}),
        ...(data.model ? { model: data.model } : {}),
        ...(data.appVersion ? { appVersion: data.appVersion } : {}),
      },
      select: { name: true },
    });
    await writeAuditLog(tx, {
      actor: { type: "SYSTEM", userId: null },
      action: AUDIT_ACTIONS.DEVICE_PAIRED,
      entityType: AUDIT_ENTITY_TYPES.DEVICE,
      entityId: deviceId,
      afterData: {
        name: device.name,
        serialNumber: data.serialNumber ?? null,
        model: data.model ?? null,
        appVersion: data.appVersion ?? null,
      },
      metadata: { source: "DEVICE" },
    });

    return { deviceId, deviceName: device.name, accessToken };
  });
}
