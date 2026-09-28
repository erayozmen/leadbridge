import "server-only";

import { DeviceStatus, DeviceTokenKind } from "@prisma/client";

import { hashDeviceToken, parseDeviceBearerToken } from "@/features/devices/lib/device-token";
import { prisma } from "@/lib/prisma";

export type AuthenticatedDevice = {
  deviceId: string;
  tokenId: string;
  status: DeviceStatus;
  appVersion: string | null;
};

/** Resolves the device behind an `Authorization: Bearer <access token>` header, or null. */
export async function authenticateDevice(
  authorization: string | null,
  now = new Date(),
): Promise<AuthenticatedDevice | null> {
  const token = parseDeviceBearerToken(authorization);
  if (!token) return null;

  const record = await prisma.deviceToken.findUnique({
    where: { tokenHash: hashDeviceToken(token) },
    select: {
      id: true,
      kind: true,
      revokedAt: true,
      expiresAt: true,
      device: { select: { id: true, status: true, appVersion: true } },
    },
  });
  if (
    !record ||
    record.kind !== DeviceTokenKind.ACCESS ||
    record.revokedAt ||
    (record.expiresAt && record.expiresAt <= now)
  ) {
    return null;
  }

  return {
    deviceId: record.device.id,
    tokenId: record.id,
    status: record.device.status,
    appVersion: record.device.appVersion,
  };
}
