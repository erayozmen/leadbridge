import "server-only";

import { DeviceTokenKind, type Prisma } from "@prisma/client";

import {
  PAIRING_CODE_TTL_MS,
  generatePairingCode,
  hashDeviceToken,
  normalizePairingCode,
} from "@/features/devices/lib/device-token";

type DeviceTransactionClient = Pick<Prisma.TransactionClient, "deviceToken" | "$executeRaw">;

export type IssuedPairingCode = {
  /** Shown once to the staff member; only its hash is stored. */
  pairingCode: string;
  expiresAt: Date;
};

/** Stores the hash of a fresh single-use pairing code for the device. */
export async function issuePairingCode(
  tx: Pick<Prisma.TransactionClient, "deviceToken">,
  deviceId: string,
  now: Date,
): Promise<IssuedPairingCode> {
  const pairingCode = generatePairingCode();
  const expiresAt = new Date(now.getTime() + PAIRING_CODE_TTL_MS);
  await tx.deviceToken.create({
    data: {
      deviceId,
      kind: DeviceTokenKind.PAIRING,
      tokenHash: hashDeviceToken(normalizePairingCode(pairingCode)!),
      expiresAt,
    },
    select: { id: true },
  });
  return { pairingCode, expiresAt };
}

/** Revokes every still-usable pairing and access token of the device. */
export async function revokeDeviceTokens(tx: DeviceTransactionClient, deviceId: string, now: Date) {
  const revoked = await tx.deviceToken.updateMany({
    where: { deviceId, revokedAt: null },
    data: { revokedAt: now },
  });
  return revoked.count;
}

/** Serializes management operations on one device for the rest of the transaction. */
export async function lockDevice(tx: Pick<Prisma.TransactionClient, "$executeRaw">, deviceId: string) {
  await tx.$executeRaw`SELECT 1 FROM "Device" WHERE "id" = ${deviceId} FOR UPDATE`;
}
