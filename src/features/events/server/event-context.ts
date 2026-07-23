import "server-only";

import { EventStatus } from "@prisma/client";

import { requireActiveUser } from "@/features/auth/server/auth";
import { LEGACY_COMPATIBILITY_EVENT_ID } from "@/features/events/server/compatibility-event";
import { prisma } from "@/lib/prisma";

export type EventContext = {
  id: string;
  name: string;
  eventDate: Date;
  location: string;
  status: EventStatus;
};

export class EventContextError extends Error {
  constructor(
    readonly code:
      | "EVENT_REQUIRED"
      | "EVENT_NOT_OPERATIONAL"
      | "MULTIPLE_ACTIVE_EVENTS",
  ) {
    super(code);
  }
}

const eventSelect = {
  id: true,
  name: true,
  eventDate: true,
  location: true,
  status: true,
} as const;

export async function resolveCompatibilityEvent(): Promise<EventContext> {
  const activeEvents = await prisma.event.findMany({
    where: { status: EventStatus.ACTIVE },
    select: eventSelect,
    orderBy: { id: "asc" },
    take: 2,
  });

  if (activeEvents.length > 1) {
    console.error("[event-context] multiple active events prevent compatibility mode");
    throw new EventContextError("MULTIPLE_ACTIVE_EVENTS");
  }
  if (activeEvents[0]) return activeEvents[0];

  const legacyEvent = await prisma.event.findUnique({
    where: { id: LEGACY_COMPATIBILITY_EVENT_ID },
    select: eventSelect,
  });
  if (!legacyEvent) throw new EventContextError("EVENT_REQUIRED");
  return legacyEvent;
}

export async function getSelectedEvent(
  user?: Awaited<ReturnType<typeof requireActiveUser>>,
): Promise<EventContext> {
  if (!user) await requireActiveUser();
  return resolveCompatibilityEvent();
}

export async function requireSelectedEvent(
  options: { operational?: boolean } = {},
): Promise<EventContext> {
  void options;
  await requireActiveUser();
  return resolveCompatibilityEvent();
}
