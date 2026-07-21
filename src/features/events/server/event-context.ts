import "server-only";

import { EventStatus, UserRole, type User } from "@prisma/client";
import { cookies } from "next/headers";
import { requireActiveUser } from "@/features/auth/server/auth";
import { prisma } from "@/lib/prisma";

export const EVENT_COOKIE = "leadbridge_event";
export type EventContext = {
  id: string;
  name: string;
  eventDate: Date;
  location: string;
  status: EventStatus;
};
export class EventContextError extends Error {
  constructor(readonly code: "EVENT_REQUIRED" | "EVENT_NOT_OPERATIONAL") {
    super(code);
  }
}

export async function listSelectableEvents(role: User["role"]) {
  return prisma.event.findMany({
    where: role === UserRole.ADMIN ? {} : { status: EventStatus.ACTIVE },
    select: {
      id: true,
      name: true,
      eventDate: true,
      location: true,
      status: true,
    },
    orderBy: { eventDate: "desc" },
  });
}

export async function getSelectedEvent(
  user?: Awaited<ReturnType<typeof requireActiveUser>>,
): Promise<EventContext | null> {
  const appUser = user ?? (await requireActiveUser());
  const selectedEventId = (await cookies()).get(EVENT_COOKIE)?.value;
  if (!selectedEventId) return null;
  return prisma.event.findFirst({
    where: {
      id: selectedEventId,
      ...(appUser.role === UserRole.STAFF
        ? { status: EventStatus.ACTIVE }
        : {}),
    },
    select: {
      id: true,
      name: true,
      eventDate: true,
      location: true,
      status: true,
    },
  });
}

export async function requireSelectedEvent(
  options: { operational?: boolean } = {},
): Promise<EventContext> {
  const user = await requireActiveUser();
  const event = await getSelectedEvent(user);
  if (!event) throw new EventContextError("EVENT_REQUIRED");
  if (options.operational && event.status !== EventStatus.ACTIVE)
    throw new EventContextError("EVENT_NOT_OPERATIONAL");
  return event;
}

export async function setSelectedEvent(eventId: string) {
  const user = await requireActiveUser();
  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
      ...(user.role === UserRole.STAFF
        ? { status: EventStatus.ACTIVE }
        : { status: { not: EventStatus.ARCHIVED } }),
    },
    select: { id: true },
  });
  if (!event) throw new EventContextError("EVENT_NOT_OPERATIONAL");
  (await cookies()).set(EVENT_COOKIE, event.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return event.id;
}
