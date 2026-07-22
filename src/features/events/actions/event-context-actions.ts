"use server";
import { redirect } from "next/navigation";
import { setSelectedEvent } from "@/features/events/server/event-context";
export async function selectEventAction(data: FormData) {
  const value = data.get("eventId");
  if (typeof value !== "string" || !value.trim()) return;
  await setSelectedEvent(value);
  redirect("/dashboard");
}
