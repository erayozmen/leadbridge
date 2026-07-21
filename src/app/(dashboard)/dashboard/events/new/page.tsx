import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireAdmin } from "@/features/auth/server/auth";
import { createEventAction } from "@/features/events/actions/event-actions";

export default async function NewEventPage() {
  await requireAdmin();
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-3xl font-semibold">Yeni Etkinlik</h1>
      <Card className="mt-8 p-5">
        <form action={createEventAction} className="grid gap-4">
          <div><Label htmlFor="name">Etkinlik adı</Label><Input id="name" name="name" required maxLength={120} /></div>
          <div><Label htmlFor="eventDate">Tarih</Label><Input id="eventDate" name="eventDate" type="datetime-local" required /></div>
          <div><Label htmlFor="location">Konum</Label><Input id="location" name="location" required maxLength={160} /></div>
          <Button>Etkinlik oluştur</Button>
        </form>
      </Card>
    </main>
  );
}
