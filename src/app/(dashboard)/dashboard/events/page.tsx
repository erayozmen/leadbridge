import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireAdmin } from "@/features/auth/server/auth";
import { prisma } from "@/lib/prisma";

export default async function EventsPage() {
  await requireAdmin();
  const events = await prisma.event.findMany({
    select: {
      id: true,
      name: true,
      eventDate: true,
      location: true,
      status: true,
      _count: { select: { vrRecords: true, qrCodes: true, qrRegistrations: true } },
    },
    orderBy: { eventDate: "desc" },
  });

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Etkinlikler</h1>
          <p className="mt-2 text-muted-foreground">
            Etkinlik yaşam döngüsünü ve operasyon kapsamını yönetin.
          </p>
        </div>
        <Button asChild><Link href="/dashboard/events/new">Yeni etkinlik</Link></Button>
      </div>
      <div className="mt-8 grid gap-4">
        {events.map((event) => (
          <Card key={event.id} className="p-5">
            <div className="flex flex-col justify-between gap-4 sm:flex-row">
              <div>
                <div className="flex gap-2">
                  <h2 className="font-semibold">{event.name}</h2>
                  <Badge>{event.status}</Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {event.eventDate.toLocaleString("tr-TR")} · {event.location}
                </p>
                <p className="mt-2 text-sm">
                  VR {event._count.vrRecords} · QR {event._count.qrCodes} · Kayıt {event._count.qrRegistrations}
                </p>
              </div>
              <Button asChild variant="outline"><Link href={`/dashboard/events/${event.id}`}>Yönet</Link></Button>
            </div>
          </Card>
        ))}
        {!events.length ? <Card className="p-10 text-center">Henüz etkinlik oluşturulmadı.</Card> : null}
      </div>
    </main>
  );
}
