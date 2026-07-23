import { requireAdmin } from "@/features/auth/server/auth";
import { ReportSummaryCards } from "@/features/reports/components/report-summary-cards";
import { getReportSummary } from "@/features/reports/queries/get-report-summary";
import { EventFilter } from "@/features/events/components/event-filter";
import { listEventFilterOptions, resolveEventFilter } from "@/features/events/server/event-filter";
import { prisma } from "@/lib/prisma";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireAdmin();
  const params = await searchParams;
  const rawEventId = Array.isArray(params.eventId) ? params.eventId[0] : params.eventId;
  const [event, events] = await Promise.all([resolveEventFilter(rawEventId), listEventFilterOptions()]);
  const summary = await getReportSummary({ requireAdmin: async () => user, getEventId: async () => event.id, countSchools: (where) => prisma.school.count({ where }), countQrCodes: (where) => prisma.qrCode.count({ where }), countVrRecords: (where) => prisma.vrRecord.count({ where }), countQrRegistrations: (where) => prisma.qrRegistration.count({ where }), countStudentMatches: (where) => prisma.studentMatch.count({ where }) });

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold">Raporlar</h1>
      <p className="mt-2 max-w-3xl text-muted-foreground">
        LeadBridge operasyon kayıtlarının mevcut ve güvenilir özetini görüntüleyin.
      </p>
      <div className="mt-6"><EventFilter events={events} selectedId={event.id} /></div>
      <div className="mt-4"><a className="text-sm font-medium underline" href={`/dashboard/exports/vr-records?eventId=${encodeURIComponent(event.id)}`}>Seçili etkinliğin VR CSV dosyasını indir</a></div>
      <ReportSummaryCards summary={summary} />
    </main>
  );
}
