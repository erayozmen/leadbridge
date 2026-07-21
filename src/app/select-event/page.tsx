import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireActiveUser } from "@/features/auth/server/auth";
import { selectEventAction } from "@/features/events/actions/event-context-actions";
import { listSelectableEvents } from "@/features/events/server/event-context";

export default async function SelectEventPage() {
  const user = await requireActiveUser();
  const events = await listSelectableEvents(user.role);

  return (
    <main className="mx-auto grid min-h-screen max-w-xl place-items-center p-6">
      <Card className="w-full p-6">
        <h1 className="text-2xl font-semibold">Etkinlik seçin</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Operasyonlar ve raporlar seçtiğiniz etkinlik kapsamında çalışır.
        </p>
        {events.length ? (
          <form action={selectEventAction} className="mt-6 grid gap-4">
            <select
              name="eventId"
              required
              className="h-10 rounded-md border bg-background px-3"
            >
              <option value="">Etkinlik seçin</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
            </select>
            <Button>Devam et</Button>
          </form>
        ) : (
          <p className="mt-6 rounded-md border p-4">
            Kullanılabilir etkinlik bulunmuyor. Bir yönetici etkinlik
            oluşturmalıdır.
          </p>
        )}
      </Card>
    </main>
  );
}
