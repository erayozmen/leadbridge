import { Bell } from "lucide-react";
import Link from "next/link";

import { getUnreadNotificationCount } from "@/features/notifications/queries/list-notifications";

export async function NotificationIndicator({ count }: { count?: number | null }) {
  const unreadCount = count === undefined ? await getUnreadNotificationCount() : count;
  const label = unreadCount === null
    ? "Bildirimler"
    : `Bildirimler, ${unreadCount} okunmamış`;

  return (
    <Link
      href="/dashboard/notifications"
      aria-label={label}
      className="relative grid size-9 place-items-center rounded-md border bg-background hover:bg-muted"
    >
      <Bell className="size-4" aria-hidden="true" />
      {unreadCount !== null && unreadCount > 0 ? (
        <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] leading-4 text-primary-foreground">
          {Math.min(unreadCount, 99)}
        </span>
      ) : null}
    </Link>
  );
}
