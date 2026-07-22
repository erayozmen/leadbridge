import "server-only";

import { z } from "zod";
import { requireActiveUser } from "@/features/auth/server/auth";
import { NOTIFICATION_TYPES } from "@/features/notifications/constants/notification-types";
import { prisma } from "@/lib/prisma";

const filtersSchema = z.object({
  page: z.coerce.number().int().positive().catch(1),
  eventId: z.string().trim().max(100).optional().catch(undefined),
  type: z.enum(NOTIFICATION_TYPES).optional().catch(undefined),
});

export async function listNotifications(input: {
  page?: number;
  eventId?: string;
  type?: string;
}) {
  const user = await requireActiveUser();
  const filters = filtersSchema.parse(input);
  const pageSize = 25;
  const where = {
    userId: user.id,
    ...(filters.eventId ? { eventId: filters.eventId } : {}),
    ...(filters.type ? { type: filters.type } : {}),
  };
  const [total, notifications] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.findMany({
      where,
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        readAt: true,
        createdAt: true,
        event: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    notifications,
    total,
    page: filters.page,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getUnreadNotificationCount() {
  const user = await requireActiveUser();
  return prisma.notification.count({ where: { userId: user.id, readAt: null } });
}
