"use server";

import { EventStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/features/auth/server/auth";
import {
  advanceEventStatus,
  createEvent,
  updateEvent,
} from "@/features/events/services/event-service";

export type EventActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
};

const value = (data: FormData, key: string) =>
  typeof data.get(key) === "string" ? String(data.get(key)) : "";

export async function createEventAction(data: FormData) {
  await requireAdmin();
  const event = await createEvent({
    name: value(data, "name"),
    eventDate: value(data, "eventDate"),
    location: value(data, "location"),
  });
  redirect(`/dashboard/events/${event.id}`);
}

export async function updateEventAction(data: FormData) {
  await requireAdmin();
  const id = value(data, "eventId");
  await updateEvent(id, {
    name: value(data, "name"),
    eventDate: value(data, "eventDate"),
    location: value(data, "location"),
  });
  revalidatePath(`/dashboard/events/${id}`);
  revalidatePath("/dashboard/events");
}

export async function advanceEventStatusAction(
  _state: EventActionState,
  data: FormData,
): Promise<EventActionState> {
  try {
    await requireAdmin();
    const id = value(data, "eventId");
    const status = value(data, "status") as EventStatus;
    await advanceEventStatus(id, status, value(data, "reason"));
    revalidatePath("/dashboard", "layout");
    return { status: "success", message: "Etkinlik durumu güncellendi." };
  } catch {
    return {
      status: "error",
      message:
        "Durum geçişi tamamlanamadı. Geçiş sırasını ve işlem nedenini kontrol edin.",
    };
  }
}
