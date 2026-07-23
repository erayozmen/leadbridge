import { Suspense } from "react";

import { EventSelector } from "@/components/dashboard/event-selector";
import { MobileSidebar } from "@/components/dashboard/mobile-sidebar";
import { NotificationIndicator } from "@/components/dashboard/notification-indicator";
import type { DashboardRole } from "@/components/dashboard/navigation";
import { UserMenu } from "@/components/dashboard/user-menu";

export function DashboardHeader({
  user,
  events,
  selectedEventId,
}: {
  user: { fullName: string; email: string; role: DashboardRole };
  events: Array<{ id: string; name: string }>;
  selectedEventId?: string;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <MobileSidebar role={user.role} />
        <div className="lg:hidden">
          <p className="font-semibold">LeadBridge</p>
          <p className="hidden text-xs text-muted-foreground sm:block">
            Öğrenci dönüşüm sistemi
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <EventSelector events={events} selectedId={selectedEventId} />
        <Suspense fallback={<NotificationIndicator count={null} />}>
          <NotificationIndicator />
        </Suspense>
        <UserMenu {...user} />
      </div>
    </header>
  );
}
