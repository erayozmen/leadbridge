import { CalendarPlus } from "lucide-react";
import { DashboardPage, DashboardSection } from "@/components/dashboard/dashboard-page";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireAdmin } from "@/features/auth/server/auth";
import { createEventAction } from "@/features/events/actions/event-actions";

export default async function NewEventPage() {
  await requireAdmin();

  return (
    <DashboardPage width="narrow">
      <PageHeader
        icon={CalendarPlus}
        title="Yeni Etkinlik"
        description="Etkinlik bilgilerini girerek katılım ve QR süreçleri için yeni bir çalışma alanı oluşturun."
      />
      <DashboardSection>
        <Card>
          <CardHeader>
            <CardTitle>Etkinlik bilgileri</CardTitle>
            <CardDescription>Zorunlu alanları eksiksiz doldurun.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createEventAction} className="grid gap-5">
              <div className="grid gap-2">
                <Label htmlFor="name">Etkinlik adı</Label>
                <Input id="name" name="name" required maxLength={120} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="eventDate">Tarih</Label>
                <Input id="eventDate" name="eventDate" type="datetime-local" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="location">Konum</Label>
                <Input id="location" name="location" required maxLength={160} />
              </div>
              <div className="flex justify-end pt-1">
                <Button>Etkinlik oluştur</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </DashboardSection>
    </DashboardPage>
  );
}
