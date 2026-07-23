import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { UserRole } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireActiveUser } from "@/features/auth/server/auth";
import { AuthError } from "@/features/auth/types/auth";
import { selectEventAction } from "@/features/events/actions/event-context-actions";
import { listSelectableEvents } from "@/features/events/server/event-context";

export default async function SelectEventPage() {
  let user;

  try {
    user = await requireActiveUser();
  } catch (error) {
    if (error instanceof AuthError) redirect("/login");
    throw error;
  }

  const events = await listSelectableEvents(user.role);
  const hasActiveEvent = events.some((event) => event.status === "ACTIVE");

  return (
    <main className="mx-auto grid min-h-screen max-w-xl place-items-center p-6">
      <Card className="w-full p-6">
        <h1 className="text-2xl font-semibold">Etkinlik seçin</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Operasyonlar ve raporlar seçtiğiniz etkinlik kapsamında çalışır.
        </p>
        {!hasActiveEvent ? (
          <div className="mt-6 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            <p>Aktif etkinlik bulunmuyor. Operasyonlara devam etmek için aktif bir etkinlik gereklidir.</p>
            {user.role === UserRole.ADMIN ? (
              <Button className="mt-3" variant="outline" asChild>
                <Link href="/dashboard/events/new">Yeni etkinlik oluştur</Link>
              </Button>
            ) : (
              <p className="mt-2">Bir yönetici etkinliği aktif hale getirmelidir.</p>
            )}
          </div>
        ) : null}
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
