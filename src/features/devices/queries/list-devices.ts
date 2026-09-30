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
      playbackState: true,
      currentVideo: { select: { displayName: true } },
      commands: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { type: true, status: true, error: true, createdAt: true, video: { select: { displayName: true } } },
      },
    },
  });
}

export type DeviceListItem = Awaited<ReturnType<typeof listDevices>>[number];
