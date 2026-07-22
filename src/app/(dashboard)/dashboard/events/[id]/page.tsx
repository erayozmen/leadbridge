import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireAdmin } from "@/features/auth/server/auth";
import { updateEventAction } from "@/features/events/actions/event-actions";
import { EventStatusAction } from "@/features/events/components/event-status-action";
import { prisma } from "@/lib/prisma";

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const event = await prisma.event.findUnique({ where: { id }, select: { id: true, name: true, eventDate: true, location: true, status: true } });
  if (!event) notFound();
  const date = new Date(event.eventDate.getTime() - event.eventDate.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  const archived = event.status === "ARCHIVED";
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-3xl font-semibold">{event.name}</h1>
      <p className="mt-2 text-muted-foreground">Durum: {event.status}</p>
      <Card className="mt-8 p-5">
        <form action={updateEventAction} className="grid gap-4">
          <input type="hidden" name="eventId" value={event.id} />
          <div><Label htmlFor="name">Etkinlik adı</Label><Input id="name" name="name" defaultValue={event.name} disabled={archived} /></div>
          <div><Label htmlFor="eventDate">Tarih</Label><Input id="eventDate" name="eventDate" type="datetime-local" defaultValue={date} disabled={archived} /></div>
          <div><Label htmlFor="location">Konum</Label><Input id="location" name="location" defaultValue={event.location} disabled={archived} /></div>
          <Button disabled={archived}>Bilgileri güncelle</Button>
        </form>
      </Card>
      <Card className="mt-6 p-5">
        <h2 className="mb-4 font-semibold">Durum yönetimi</h2>
        <EventStatusAction eventId={event.id} status={event.status} />
      </Card>
    </main>
  );
}
