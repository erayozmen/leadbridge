import { redirect } from "next/navigation";
import { connection } from "next/server";

import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { requireActiveUser } from "@/features/auth/server/auth";
import { AuthError } from "@/features/auth/types/auth";
import { getSelectedEvent, listSelectableEvents } from "@/features/events/server/event-context";
import { getUnreadNotificationCount } from "@/features/notifications/queries/list-notifications";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await connection();

  let user;

  try {
    user = await requireActiveUser();
  } catch (error) {
    if (error instanceof AuthError) redirect("/login");
    throw error;
  }

  const [events, selectedEvent, unreadNotificationCount] = await Promise.all([
    listSelectableEvents(user.role),
    getSelectedEvent(user),
    getUnreadNotificationCount(),
  ]);
  return (
    <div className="min-h-screen bg-muted/20">
      <AppSidebar role={user.role} />
      <div className="min-h-screen lg:pl-64">
        <DashboardHeader
          user={{ fullName: user.fullName, email: user.email, role: user.role }}
          events={events.map(({id,name})=>({id,name}))}
          selectedEventId={selectedEvent?.id}
          unreadNotificationCount={unreadNotificationCount}
        />
        {children}
      </div>
    </div>
  );
}
