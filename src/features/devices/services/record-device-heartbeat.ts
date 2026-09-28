import "server-only";

import { DeviceStatus } from "@prisma/client";

import { AUDIT_ACTIONS } from "@/features/audit/constants/audit-actions";
import { AUDIT_ENTITY_TYPES } from "@/features/audit/constants/audit-entity-types";
import { writeAuditLog } from "@/features/audit/services/write-audit-log";
import { deviceHeartbeatSchema } from "@/features/devices/schemas/device-schemas";
import type { AuthenticatedDevice } from "@/features/devices/server/authenticate-device";
import { DeviceError } from "@/features/devices/services/device-errors";
import { prisma } from "@/lib/prisma";

export type DeviceHeartbeatResult = {
  status: DeviceStatus;
  serverTime: string;
};

/**
 * Records a heartbeat: refreshes lastSeenAt/appVersion and activates a freshly paired device.
 * Only state changes are audited, not every heartbeat.
 */
export async function recordDeviceHeartbeat(
  device: AuthenticatedDevice,
  input: unknown,
  now = new Date(),
): Promise<DeviceHeartbeatResult> {
  const data = deviceHeartbeatSchema.parse(input);
  if (device.status === DeviceStatus.DISABLED) throw new DeviceError("DEVICE_DISABLED");

  const activated = device.status === DeviceStatus.PENDING;
  const status = activated ? DeviceStatus.ACTIVE : device.status;

  return prisma.$transaction(async (tx) => {
    // The status guard keeps a device disabled mid-request from being reactivated.
    const updated = await tx.device.updateMany({
      where: { id: device.deviceId, status: { not: DeviceStatus.DISABLED } },
      data: { lastSeenAt: now, appVersion: data.appVersion, status },
    });
    if (updated.count !== 1) throw new DeviceError("DEVICE_DISABLED");

    await tx.deviceToken.update({
      where: { id: device.tokenId },
      data: { lastUsedAt: now },
      select: { id: true },
    });

    const actor = { type: "SYSTEM", userId: null } as const;
    const metadata = { source: "DEVICE" };
    if (activated) {
      await writeAuditLog(tx, {
        actor,
        action: AUDIT_ACTIONS.DEVICE_ACTIVATED,
        entityType: AUDIT_ENTITY_TYPES.DEVICE,
        entityId: device.deviceId,
        beforeData: { status: DeviceStatus.PENDING },
        afterData: { status: DeviceStatus.ACTIVE },
        metadata,
      });
    }
    if (device.appVersion !== data.appVersion) {
      await writeAuditLog(tx, {
        actor,
        action: AUDIT_ACTIONS.DEVICE_APP_VERSION_CHANGED,
        entityType: AUDIT_ENTITY_TYPES.DEVICE,
        entityId: device.deviceId,
        beforeData: { appVersion: device.appVersion },
        afterData: { appVersion: data.appVersion },
        metadata,
      });
    }

    return { status, serverTime: now.toISOString() };
  });
}
