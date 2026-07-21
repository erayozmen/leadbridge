import "server-only";

import { EventStatus } from "@prisma/client";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "leadbridge_event";

export async function getActiveEvent() {
  const selectedId = (await cookies()).get(COOKIE_NAME)?.value;
  if (selectedId) {
    const selected = await prisma.event.findFirst({ where: { id: selectedId, status: EventStatus.ACTIVE }, select: { id: true, name: true, eventDate: true, location: true } });
    if (selected) return selected;
  }
  return prisma.event.findFirst({ where: { status: EventStatus.ACTIVE }, select: { id: true, name: true, eventDate: true, location: true }, orderBy: { eventDate: "desc" } });
}

export async function requireActiveEvent() {
  const event = await getActiveEvent();
  if (!event) throw new Error("ACTIVE_EVENT_REQUIRED");
  return event;
}

export async function setActiveEventCookie(eventId: string) {
  (await cookies()).set(COOKIE_NAME, eventId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/dashboard", maxAge: 60 * 60 * 24 * 30 });
}
