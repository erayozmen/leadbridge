import "server-only";

import { requireAdmin } from "@/features/auth/server/auth";
import { requireSelectedEvent } from "@/features/events/server/event-context";
import { prisma } from "@/lib/prisma";

export async function listEventFilterOptions() {
  await requireAdmin();
  return prisma.event.findMany({
    select: { id: true, name: true, status: true },
    orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
  });
}

export async function resolveEventFilter(eventId?: string) {
  await requireAdmin();
  const normalized = eventId?.trim();
  if (!normalized) return requireSelectedEvent();
  const event = await prisma.event.findUnique({
    where: { id: normalized },
    select: { id: true, name: true, status: true },
  });
  return event ?? requireSelectedEvent();
}
