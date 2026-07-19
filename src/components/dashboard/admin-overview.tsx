import {
  BookOpenCheck,
  ClipboardCheck,
  QrCode,
  UserRoundCheck,
  Video,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import type { DashboardOverviewSummary } from "@/features/reports/types/dashboard-overview-summary";

export type OverviewMetric = {
  key: keyof DashboardOverviewSummary;
  cardLabel: string;
  funnelLabel: string;
  value: number;
  icon: LucideIcon;
};

export function buildDashboardOverviewMetrics(
  summary: DashboardOverviewSummary,
): OverviewMetric[] {
  return [
    { key: "totalVrRecords", cardLabel: "VR Kaydı", funnelLabel: "VR İzledi", value: summary.totalVrRecords, icon: Video },
    { key: "distributedQrCodes", cardLabel: "QR Dağıtılan", funnelLabel: "QR Verildi", value: summary.distributedQrCodes, icon: QrCode },
    { key: "totalQrRegistrations", cardLabel: "QR ile Kayıt Olan", funnelLabel: "QR Kayıt", value: summary.totalQrRegistrations, icon: UserRoundCheck },
    { key: "attendedRegistrations", cardLabel: "Etkinliğe Gelen", funnelLabel: "Etkinliğe Geldi", value: summary.attendedRegistrations, icon: ClipboardCheck },
    { key: "courseEnrollments", cardLabel: "Dil Kursuna Kayıt Olan", funnelLabel: "Kursa Yazıldı", value: summary.courseEnrollments, icon: BookOpenCheck },
  ];
}

export function AdminOverview({ summary }: { summary: DashboardOverviewSummary }) {
  const metrics = buildDashboardOverviewMetrics(summary);

  return (
    <>
      <div>
        <Badge variant="secondary">Yönetici görünümü</Badge>
        <h1 className="mt-3 text-3xl font-semibold">Genel Bakış</h1>
        <p className="mt-2 text-muted-foreground">
          Günlük operasyon akışının temel kayıt sayılarını tek noktadan izleyin.
        </p>
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5" aria-label="Operasyon metrikleri">
        {metrics.map(({ key, cardLabel, value, icon: Icon }) => (
          <Card key={key} className="gap-4 rounded-lg py-5 shadow-none">
            <CardHeader className="flex grid-cols-[1fr_auto] flex-row items-center justify-between gap-3 px-5">
              <CardDescription className="font-medium">{cardLabel}</CardDescription>
              <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-5">
              <p className="text-3xl font-semibold tabular-nums" aria-label={`${cardLabel}: ${value}`}>
                {value}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="mt-6" aria-labelledby="conversion-funnel-title">
        <Card className="rounded-lg shadow-none">
          <CardHeader>
            <h2 id="conversion-funnel-title" className="font-semibold">Dönüşüm hunisi</h2>
            <CardDescription>Kayıt akışının beş temel adımı</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="grid gap-3 sm:grid-cols-5">
              {metrics.map(({ key, funnelLabel, value }, index) => (
                <li key={key} className="rounded-md border p-4">
                  <span className="text-xs font-medium text-muted-foreground">Adım {index + 1}</span>
                  <p className="mt-2 text-sm font-medium">{funnelLabel}</p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </section>
    </>
  );
}
