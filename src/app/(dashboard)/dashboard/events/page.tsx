import { EventStatus } from "@prisma/client";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requireAdmin } from "@/features/auth/server/auth";
import { prisma } from "@/lib/prisma";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

export default async function EventsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const params = await searchParams;
  const query = first(params.query)?.trim().slice(0, 120) ?? "";
  const rawStatus = first(params.status);
  const status = Object.values(EventStatus).includes(rawStatus as EventStatus) ? rawStatus as EventStatus : undefined;
  const events = await prisma.event.findMany({
    where: {
      ...(query ? { name: { contains: query, mode: "insensitive" } } : {}),
      ...(status ? { status } : {}),
    },
    select: { id: true, name: true, eventDate: true, location: true, status: true, _count: { select: { vrRecords: true, qrCodes: true, qrRegistrations: true } } },
    orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
  });
  return <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h1 className="text-3xl font-semibold">Etkinlikler</h1><p className="mt-2 text-muted-foreground">Etkinlikleri ve yaşam döngülerini yönetin.</p></div><Button asChild><Link href="/dashboard/events/new">Yeni etkinlik</Link></Button></div>
    <form className="mt-6 grid gap-3 sm:grid-cols-[1fr_220px_auto]" method="get"><Input name="query" defaultValue={query} placeholder="Etkinlik ara" maxLength={120} /><select name="status" defaultValue={status ?? ""} className="h-9 rounded-md border bg-background px-3 text-sm"><option value="">Tüm durumlar</option>{Object.values(EventStatus).map((value) => <option key={value} value={value}>{value}</option>)}</select><Button type="submit">Filtrele</Button></form>
    <div className="mt-8 grid gap-4">{events.map((event) => <Card key={event.id} className="p-5"><div className="flex flex-col justify-between gap-4 sm:flex-row"><div><div className="flex items-center gap-2"><h2 className="font-semibold">{event.name}</h2><Badge variant={event.status === "ARCHIVED" ? "secondary" : "default"}>{event.status}</Badge></div><p className="mt-2 text-sm text-muted-foreground">{event.eventDate.toLocaleString("tr-TR")} · {event.location}</p><p className="mt-2 text-sm">VR {event._count.vrRecords} · QR {event._count.qrCodes} · Kayıt {event._count.qrRegistrations}</p></div><Button asChild variant="outline"><Link href={`/dashboard/events/${event.id}`}>Yönet</Link></Button></div></Card>)}{events.length === 0 ? <Card className="p-10 text-center">Filtrelerle eşleşen etkinlik bulunamadı.</Card> : null}</div>
  </main>;
}
