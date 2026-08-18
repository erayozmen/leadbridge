import {
  BookOpenCheck,
  ClipboardCheck,
  QrCode,
  UserRoundCheck,
  Video,
  type LucideIcon,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import Link from "next/link";
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

export function AdminOverview({
  summary,
  eventName = "LeadBridge operasyonu",
}: {
  summary: DashboardOverviewSummary;
  eventName?: string;
}) {
  const metrics = buildDashboardOverviewMetrics(summary);

  return (
    <>
      <section className="relative overflow-hidden rounded-lg bg-[#0b3437] px-5 py-7 text-white shadow-[0_20px_50px_rgb(7_48_54/0.18)] sm:px-7 sm:py-8" aria-labelledby="dashboard-title">
        <div aria-hidden="true" className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgb(255_255_255/0.08)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.07)_1px,transparent_1px)] [background-size:36px_36px]" />
        <div className="relative grid gap-7 lg:grid-cols-[1.35fr_1fr] lg:items-end">
          <div>
            <Badge className="border-emerald-200/20 bg-emerald-200/10 text-emerald-100 hover:bg-emerald-200/10">
              <Sparkles aria-hidden="true" />
              Yönetici görünümü
            </Badge>
            <p className="mt-5 text-xs font-semibold text-emerald-200 uppercase">Güncel etkinlik · {eventName}</p>
            <h1 id="dashboard-title" className="mt-2 max-w-2xl text-3xl font-semibold text-balance sm:text-4xl">
              Operasyonun tamamı tek bakışta.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/65 sm:text-base">
              VR deneyiminden etkinlik katılımına uzanan öğrenci akışını güvenilir verilerle yönetin.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button asChild className="bg-emerald-300 text-emerald-950 shadow-lg hover:bg-emerald-200">
                <Link href="/dashboard/vr-records/new">Yeni VR kaydı <ArrowRight aria-hidden="true" /></Link>
              </Button>
              <Button asChild variant="outline" className="border-white/20 bg-white/7 text-white hover:bg-white/12 hover:text-white">
                <Link href="/dashboard/reports">Raporları aç</Link>
              </Button>
            </div>
          </div>
          <dl className="grid grid-cols-3 gap-2 rounded-lg border border-white/10 bg-white/6 p-3 backdrop-blur-sm">
            {[
              ["QR kayıt", summary.totalQrRegistrations],
              ["Katılım", summary.attendedRegistrations],
              ["Kurs", summary.courseEnrollments],
            ].map(([label, value]) => (
              <div key={String(label)} className="min-w-0 rounded-md border border-white/8 bg-black/8 px-3 py-4">
                <dt className="truncate text-[11px] text-white/55">{label}</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="mt-8 grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-5" aria-label="Operasyon metrikleri">
        {metrics.map(({ key, cardLabel, value, icon: Icon }) => (
          <Card key={key} className="group gap-4 overflow-hidden py-5 hover:-translate-y-1 hover:border-primary/25 hover:shadow-[0_18px_38px_rgb(15_23_42/0.09)]">
            <CardHeader className="flex grid-cols-[1fr_auto] flex-row items-center justify-between gap-3 px-5">
              <CardDescription className="font-medium">{cardLabel}</CardDescription>
              <span className="grid size-10 place-items-center rounded-md border border-primary/10 bg-secondary text-secondary-foreground transition-colors group-hover:bg-accent">
                <Icon aria-hidden="true" className="size-4" />
              </span>
            </CardHeader>
            <CardContent className="px-5">
              <p className="text-3xl font-semibold tabular-nums sm:text-4xl" aria-label={`${cardLabel}: ${value}`}>
                {value}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="mt-6" aria-labelledby="attention-title">
        <Card>
          <CardHeader><h2 id="attention-title" className="font-semibold">Dikkat gerektiren kayıtlar</h2><CardDescription>Operasyon akışında tamamlanmayı bekleyen kayıtlar</CardDescription></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["Atandı, form yok", summary.assignedWithoutRegistration, "/dashboard/qr-codes?status=ASSIGNED"],
              ["Form var, katılım yok", summary.registeredNotAttended, "/dashboard/attendance?attendance=not-attended"],
              ["Katıldı, kurs yok", summary.attendedNotEnrolled, "/dashboard/reports"],
              ["Eşleşmemiş QR kaydı", summary.unmatchedRegistrations, "/dashboard/qr-registrations?matchStatus=unmatched"],
              ["Eşleşmemiş VR kaydı", summary.unmatchedVrRecords, "/dashboard/vr-records?matchStatus=unmatched"],
            ].map(([label, value, href]) => <Link key={String(label)} href={String(href)} className="rounded-md border bg-background p-4 transition-colors hover:border-primary/25 hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring"><span className="text-sm text-muted-foreground">{label}</span><strong className="mt-2 block text-2xl tabular-nums">{value}</strong></Link>)}
          </CardContent>
        </Card>
      </section>

      <section className="mt-6" aria-labelledby="conversion-funnel-title">
        <Card>
          <CardHeader>
            <h2 id="conversion-funnel-title" className="font-semibold">Dönüşüm hunisi</h2>
            <CardDescription>Kayıt akışının beş temel adımı</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="grid gap-3 sm:grid-cols-5">
              {metrics.map(({ key, funnelLabel, value }, index) => (
                <li key={key} className="rounded-md border bg-muted/25 p-4">
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
