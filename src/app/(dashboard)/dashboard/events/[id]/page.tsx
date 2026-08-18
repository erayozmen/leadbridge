import { CalendarDays } from "lucide-react";
import { notFound } from "next/navigation";
import { DashboardPage, DashboardSection } from "@/components/dashboard/dashboard-page";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { requireAdmin } from "@/features/auth/server/auth";
import { updateEventAction } from "@/features/events/actions/event-actions";
import { EventStatusAction } from "@/features/events/components/event-status-action";
import { prisma } from "@/lib/prisma";

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const event = await prisma.event.findUnique({
    where: { id },
    select: { id: true, name: true, eventDate: true, location: true, status: true },
  });
  if (!event) notFound();

  const date = new Date(event.eventDate.getTime() - event.eventDate.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
  const archived = event.status === "ARCHIVED";

  return (
    <DashboardPage width="narrow">
      <PageHeader
        icon={CalendarDays}
        title={event.name}
        description="Etkinliğin temel bilgilerini ve kullanım durumunu yönetin."
        eyebrow={<StatusBadge status={event.status} />}
      />
      <DashboardSection className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Etkinlik bilgileri</CardTitle>
            <CardDescription>{archived ? "Arşivlenmiş etkinlik bilgileri salt okunurdur." : "Katılımcılara gösterilecek güncel bilgiler."}</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateEventAction} className="grid gap-5">
              <input type="hidden" name="eventId" value={event.id} />
              <div className="grid gap-2">
                <Label htmlFor="name">Etkinlik adı</Label>
                <Input id="name" name="name" defaultValue={event.name} disabled={archived} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="eventDate">Tarih</Label>
                <Input id="eventDate" name="eventDate" type="datetime-local" defaultValue={date} disabled={archived} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="location">Konum</Label>
                <Input id="location" name="location" defaultValue={event.location} disabled={archived} />
              </div>
              <div className="flex justify-end pt-1">
                <Button disabled={archived}>Bilgileri güncelle</Button>
              </div>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Durum yönetimi</CardTitle>
            <CardDescription>Etkinliğin aktif veya arşivlenmiş durumunu güvenli şekilde yönetin.</CardDescription>
          </CardHeader>
          <CardContent>
            <EventStatusAction eventId={event.id} status={event.status} />
          </CardContent>
        </Card>
      </DashboardSection>
    </DashboardPage>
  );
}
