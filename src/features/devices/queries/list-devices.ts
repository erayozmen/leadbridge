import "server-only";

import { prisma } from "@/lib/prisma";

const DEVICE_LIST_LIMIT = 200;

/** Lists devices for the dashboard. Token data is never selected. */
export function listDevices() {
  return prisma.device.findMany({
    orderBy: { createdAt: "desc" },
    take: DEVICE_LIST_LIMIT,
    select: {
      id: true,
      name: true,
      serialNumber: true,
      model: true,
      status: true,
      appVersion: true,
      lastSeenAt: true,
    },
  });
}

export type DeviceListItem = Awaited<ReturnType<typeof listDevices>>[number];
