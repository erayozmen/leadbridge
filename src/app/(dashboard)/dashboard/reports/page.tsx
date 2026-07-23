import { requireAdmin } from "@/features/auth/server/auth";
import { ChartNoAxesCombined } from "lucide-react";
import { ReportSummaryCards } from "@/features/reports/components/report-summary-cards";
import { getReportSummary } from "@/features/reports/queries/get-report-summary";
import { EventFilter } from "@/features/events/components/event-filter";
import { listEventFilterOptions, resolveEventFilter } from "@/features/events/server/event-filter";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireAdmin();
  const params = await searchParams;
  const rawEventId = Array.isArray(params.eventId) ? params.eventId[0] : params.eventId;
  const [event, events] = await Promise.all([resolveEventFilter(rawEventId), listEventFilterOptions()]);
  const summary = await getReportSummary({ requireAdmin: async () => user, getEventId: async () => event.id, countSchools: (where) => prisma.school.count({ where }), countQrCodes: (where) => prisma.qrCode.count({ where }), countVrRecords: (where) => prisma.vrRecord.count({ where }), countQrRegistrations: (where) => prisma.qrRegistration.count({ where }), countStudentMatches: (where) => prisma.studentMatch.count({ where }) });

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader icon={ChartNoAxesCombined} title="Raporlar" description="LeadBridge operasyon kayıtlarının mevcut ve güvenilir özetini görüntüleyin." actions={<Button asChild variant="outline"><a href={`/dashboard/exports/vr-records?eventId=${encodeURIComponent(event.id)}`}>VR CSV indir</a></Button>} />
      <div className="mt-6 rounded-lg border border-white/80 bg-card/90 p-4 shadow-sm"><EventFilter events={events} selectedId={event.id} /></div>
      <ReportSummaryCards summary={summary} />
    </main>
  );
}
