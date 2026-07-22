import "server-only";
import type { Prisma } from "@prisma/client";
import type { NotificationType } from "@/features/notifications/constants/notification-types";

export type NotificationWriter = Pick<Prisma.TransactionClient, "notification">;
export async function createNotification(
  client: NotificationWriter,
  input: {
    userId: string;
    eventId?: string | null;
    type: NotificationType;
    title: string;
    message: string;
    relatedEntityType?: string;
    relatedEntityId?: string;
  },
) {
  return client.notification.create({
    data: {
      userId: input.userId,
      eventId: input.eventId ?? null,
      type: input.type,
      title: input.title.trim().slice(0, 120),
      message: input.message.trim().slice(0, 500),
      relatedEntityType: input.relatedEntityType,
      relatedEntityId: input.relatedEntityId,
    },
    select: { id: true },
  });
}
