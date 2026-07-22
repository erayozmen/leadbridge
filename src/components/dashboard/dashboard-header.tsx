import { MobileSidebar } from "@/components/dashboard/mobile-sidebar";
import type { DashboardRole } from "@/components/dashboard/navigation";
import { UserMenu } from "@/components/dashboard/user-menu";
import { EventSelector } from "@/components/dashboard/event-selector";
import { Bell } from "lucide-react";
import Link from "next/link";

export function DashboardHeader({
  user,
  events,
  selectedEventId,
  unreadNotificationCount,
}: {
  user: { fullName: string; email: string; role: DashboardRole };
  events: Array<{id:string;name:string}>;
  selectedEventId?: string;
  unreadNotificationCount: number;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <MobileSidebar role={user.role} />
        <div className="lg:hidden">
          <p className="font-semibold">LeadBridge</p>
          <p className="hidden text-xs text-muted-foreground sm:block">Öğrenci dönüşüm sistemi</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <EventSelector events={events} selectedId={selectedEventId} />
        <Link
          href="/dashboard/notifications"
          aria-label={`Bildirimler, ${unreadNotificationCount} okunmamış`}
          className="relative grid size-9 place-items-center rounded-md border bg-background hover:bg-muted"
        >
          <Bell className="size-4" aria-hidden="true" />
          {unreadNotificationCount > 0 ? (
            <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] leading-4 text-primary-foreground">
              {Math.min(unreadNotificationCount, 99)}
            </span>
          ) : null}
        </Link>
        <UserMenu {...user} />
      </div>
    </header>
  );
}
