import { ClipboardCheck, Search, Video, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminOverview } from "@/components/dashboard/admin-overview";
import { requireActiveUser } from "@/features/auth/server/auth";
import { getSelectedEvent } from "@/features/events/server/event-context";
import { getDashboardOverviewSummary } from "@/features/reports/queries/get-dashboard-overview-summary";

export const dashboardQuickActions: Array<{ label: string; icon: LucideIcon; href: string }> = [
  { label: "Yeni VR Kaydı", icon: Video, href: "/dashboard/vr-records/new" },
  { label: "VR İzleyenler", icon: Search, href: "/dashboard/vr-records" },
  { label: "Etkinlik Katılımı", icon: ClipboardCheck, href: "/dashboard/attendance" },
];

function QuickActions() {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {dashboardQuickActions.map(({ label, icon: Icon, href }) => (
        <Button key={label} variant="outline" className="h-auto justify-start gap-3 px-4 py-4" asChild>
          <Link href={href}>
            <span className="grid size-9 place-items-center rounded-md bg-secondary text-foreground">
              <Icon aria-hidden="true" />
            </span>
            <span className="text-left">
              <span className="block">{label}</span>
              <span className="block text-xs font-normal text-muted-foreground">Aç</span>
            </span>
          </Link>
        </Button>
      ))}
    </div>
  );
}

function StaffDashboard({ fullName }: { fullName: string }) {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-2xl">
        <Badge variant="secondary">Standart Kullanıcı</Badge>
        <h1 className="mt-4 text-3xl font-semibold">Hoş geldiniz, {fullName}</h1>
        <p className="mt-2 text-muted-foreground">
          Günlük öğrenci ve etkinlik işlemlerine buradan erişebilirsiniz.
        </p>
      </div>
      <section className="mt-10" aria-labelledby="quick-actions-title">
        <h2 id="quick-actions-title" className="mb-4 text-sm font-semibold">Hızlı işlemler</h2>
        <QuickActions />
      </section>
    </main>
  );
}

export default async function DashboardPage() {
  const user = await requireActiveUser();
  const selectedEvent = await getSelectedEvent(user);
  if (!selectedEvent) redirect("/select-event");

  if (user.role === "STAFF") return <StaffDashboard fullName={user.fullName} />;

  const summary = await getDashboardOverviewSummary();

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <AdminOverview summary={summary} />
      <section className="mt-6" aria-labelledby="quick-actions-title">
        <h2 id="quick-actions-title" className="mb-4 text-sm font-semibold">Hızlı işlemler</h2>
        <QuickActions />
      </section>
    </main>
  );
}
