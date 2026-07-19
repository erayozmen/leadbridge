import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReportSummary } from "@/features/reports/types/report-summary";

type Metric = { label: string; value: number };
type MetricGroup = { title: string; metrics: Metric[] };

export function buildReportMetricGroups(summary: ReportSummary): MetricGroup[] {
  return [
    {
      title: "Okul",
      metrics: [{ label: "Toplam Okul Kaydı", value: summary.totalSchools }],
    },
    {
      title: "QR Durumu",
      metrics: [
        { label: "Üretilen QR Kaydı", value: summary.totalQrCodes },
        { label: "Şu Anda Atanmış QR", value: summary.assignedQrCodes },
        { label: "Kullanılmış QR", value: summary.usedQrCodes },
        { label: "Arşivlenmiş QR", value: summary.archivedQrCodes },
      ],
    },
    {
      title: "Kayıt ve Eşleşme",
      metrics: [
        { label: "VR Kaydı", value: summary.totalVrRecords },
        { label: "QR Kaydı", value: summary.totalQrRegistrations },
        { label: "Eşleşme", value: summary.totalMatches },
        { label: "Eşleşmemiş VR Kaydı", value: summary.unmatchedVrRecords },
        { label: "Eşleşmemiş QR Kaydı", value: summary.unmatchedQrRegistrations },
      ],
    },
    {
      title: "Katılım ve Dil Kursu",
      metrics: [
        { label: "Katılım İşaretli Kayıt", value: summary.attendedRegistrations },
        { label: "Katılmadı Durumundaki Kayıt", value: summary.notAttendedRegistrations },
        { label: "Dil Kursu Kaydı", value: summary.courseEnrollments },
      ],
    },
  ];
}

export function ReportSummaryCards({ summary }: { summary: ReportSummary }) {
  return (
    <div className="mt-8 space-y-8">
      {buildReportMetricGroups(summary).map((group) => (
        <section key={group.title} aria-labelledby={`report-${group.title}`}>
          <h2 id={`report-${group.title}`} className="mb-3 text-sm font-semibold">
            {group.title}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {group.metrics.map((metric) => (
              <Card key={metric.label} className="gap-3 rounded-lg py-5 shadow-none">
                <CardHeader className="px-5">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {metric.label}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-5">
                  <p className="text-3xl font-semibold tabular-nums">{metric.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
