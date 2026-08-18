import { ClipboardCheck, Search, Video, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminOverview } from "@/components/dashboard/admin-overview";
import { requireActiveUser } from "@/features/auth/server/auth";
import { getDashboardOverviewSummary } from "@/features/reports/queries/get-dashboard-overview-summary";
import { EventFilter } from "@/features/events/components/event-filter";
import { listEventFilterOptions, resolveEventFilter } from "@/features/events/server/event-filter";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/dashboard/page-header";
import { DashboardPage as DashboardPageShell } from "@/components/dashboard/dashboard-page";

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
    <DashboardPageShell>
      <PageHeader
        title={`Hoş geldiniz, ${fullName}`}
        description="Günlük öğrenci ve etkinlik işlemlerine buradan erişebilirsiniz."
        eyebrow={<Badge variant="secondary">Standart Kullanıcı</Badge>}
      />
      <section className="mt-10" aria-labelledby="quick-actions-title">
        <h2 id="quick-actions-title" className="mb-4 text-sm font-semibold">Hızlı işlemler</h2>
        <QuickActions />
      </section>
    </DashboardPageShell>
  );
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireActiveUser();
  if (user.role === "STAFF") return <StaffDashboard fullName={user.fullName} />;
  const params = await searchParams;
  const rawEventId = Array.isArray(params.eventId) ? params.eventId[0] : params.eventId;
  const [event, events] = await Promise.all([resolveEventFilter(rawEventId), listEventFilterOptions()]);
  const summary = await getDashboardOverviewSummary({
    requireAdmin: async () => user,
    getEventId: async () => event.id,
    countVrRecords: (where) => prisma.vrRecord.count({ where }),
    countQrCodes: (where) => prisma.qrCode.count({ where }),
    countQrRegistrations: (where) => prisma.qrRegistration.count({ where }),
  });

  return (
    <DashboardPageShell>
      <div className="mb-6 rounded-lg border bg-card p-4"><EventFilter events={events} selectedId={event.id} /></div>
      <AdminOverview summary={summary} eventName={event.name} />
      <section className="mt-6" aria-labelledby="quick-actions-title">
        <h2 id="quick-actions-title" className="mb-4 text-sm font-semibold">Hızlı işlemler</h2>
        <QuickActions />
      </section>
    </DashboardPageShell>
  );
}
