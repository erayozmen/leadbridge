import { EventStatus } from "@prisma/client";
import { CalendarDays, Plus, Search } from "lucide-react";
import Link from "next/link";
import { DashboardPage, DashboardSection } from "@/components/dashboard/dashboard-page";
import { PageHeader } from "@/components/dashboard/page-header";
import { DataEmptyState, FilterToolbar } from "@/components/shared/data-surface";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/dashboard/status-badge";
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
  const events = await prisma.event.findMany({ where: { ...(query ? { name: { contains: query, mode: "insensitive" } } : {}), ...(status ? { status } : {}) }, select: { id: true, name: true, eventDate: true, location: true, status: true, _count: { select: { vrRecords: true, qrCodes: true, qrRegistrations: true } } }, orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }] });
  return <DashboardPage>
    <PageHeader icon={CalendarDays} title="Etkinlikler" description="Etkinlikleri ve yaşam döngülerini yönetin." actions={<Button asChild><Link href="/dashboard/events/new"><Plus />Yeni etkinlik</Link></Button>} />
    <DashboardSection>
      <FilterToolbar method="get" className="rounded-lg border border-white/80 bg-card/90 shadow-sm sm:grid-cols-[minmax(0,1fr)_13rem_auto] sm:items-end"><Input name="query" defaultValue={query} placeholder="Etkinlik ara" aria-label="Etkinlik ara" maxLength={120} /><select name="status" defaultValue={status ?? ""} aria-label="Etkinlik durumu"><option value="">Tüm durumlar</option>{Object.values(EventStatus).map((value) => <option key={value} value={value}>{value}</option>)}</select><Button type="submit"><Search />Filtrele</Button></FilterToolbar>
      <div className="mt-6 grid gap-3">{events.map((event) => <Card key={event.id} className="p-5 transition-colors hover:border-primary/25"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{event.name}</h2><StatusBadge status={event.status} /></div><p className="mt-2 text-sm text-muted-foreground">{event.eventDate.toLocaleString("tr-TR")} · {event.location}</p><p className="mt-3 text-sm font-medium">VR {event._count.vrRecords} · QR {event._count.qrCodes} · Kayıt {event._count.qrRegistrations}</p></div><Button asChild variant="outline"><Link href={`/dashboard/events/${event.id}`}>Yönet</Link></Button></div></Card>)}{events.length === 0 ? <Card><DataEmptyState icon={CalendarDays} title="Filtrelerle eşleşen etkinlik bulunamadı." description="Arama veya durum filtresini değiştirerek yeniden deneyin." /></Card> : null}</div>
    </DashboardSection>
  </DashboardPage>;
}
