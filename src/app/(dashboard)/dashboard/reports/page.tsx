import { requireAdmin } from "@/features/auth/server/auth";
import { ReportSummaryCards } from "@/features/reports/components/report-summary-cards";
import { getReportSummary } from "@/features/reports/queries/get-report-summary";

export default async function ReportsPage() {
  await requireAdmin();
  const summary = await getReportSummary();

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold">Raporlar</h1>
      <p className="mt-2 max-w-3xl text-muted-foreground">
        LeadBridge operasyon kayıtlarının mevcut ve güvenilir özetini görüntüleyin.
      </p>
      <ReportSummaryCards summary={summary} />
    </main>
  );
}
