import Link from "next/link";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/features/notifications/actions/notification-actions";
import { NOTIFICATION_TYPES } from "@/features/notifications/constants/notification-types";
import { listNotifications } from "@/features/notifications/queries/list-notifications";
import { Button } from "@/components/ui/button";

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const result = await listNotifications({
    page: Number(first(params.page)),
    eventId: first(params.eventId),
    type: first(params.type),
  });

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Bildirimler</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Size ait operasyonel bildirimler.
          </p>
        </div>
        <form action={markAllNotificationsReadAction}>
          <Button variant="outline">Tümünü okundu yap</Button>
        </form>
      </div>

      <form className="mt-6 flex flex-wrap gap-3" method="get">
        <select
          name="type"
          defaultValue={first(params.type) ?? ""}
          className="h-10 rounded-md border bg-background px-3 text-sm"
          aria-label="Bildirim türü"
        >
          <option value="">Tüm türler</option>
          {Object.values(NOTIFICATION_TYPES).map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        <Button type="submit">Filtrele</Button>
        <Button variant="ghost" asChild>
          <Link href="/dashboard/notifications">Temizle</Link>
        </Button>
      </form>

      <div className="mt-6 divide-y rounded-md border bg-background">
        {result.notifications.length ? (
          result.notifications.map((notification) => (
            <article
              key={notification.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-medium">{notification.title}</h2>
                  {!notification.readAt ? (
                    <span className="rounded bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                      Yeni
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {notification.message}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {notification.event?.name ?? "Genel"} ·{" "}
                  {notification.createdAt.toLocaleString("tr-TR")}
                </p>
              </div>
              {!notification.readAt ? (
                <form action={markNotificationReadAction}>
                  <input
                    type="hidden"
                    name="notificationId"
                    value={notification.id}
                  />
                  <Button size="sm" variant="outline">
                    Okundu yap
                  </Button>
                </form>
              ) : null}
            </article>
          ))
        ) : (
          <p className="p-8 text-center text-sm text-muted-foreground">
            Bu filtrelerde bildirim bulunmuyor.
          </p>
        )}
      </div>

      <nav className="mt-6 flex justify-between" aria-label="Sayfalama">
        <Button variant="outline" disabled={result.page <= 1} asChild={result.page > 1}>
          {result.page > 1 ? (
            <Link href={`?page=${result.page - 1}`}>Önceki</Link>
          ) : (
            <span>Önceki</span>
          )}
        </Button>
        <span className="self-center text-sm text-muted-foreground">
          {result.page} / {result.pageCount}
        </span>
        <Button
          variant="outline"
          disabled={result.page >= result.pageCount}
          asChild={result.page < result.pageCount}
        >
          {result.page < result.pageCount ? (
            <Link href={`?page=${result.page + 1}`}>Sonraki</Link>
          ) : (
            <span>Sonraki</span>
          )}
        </Button>
      </nav>
    </main>
  );
}
