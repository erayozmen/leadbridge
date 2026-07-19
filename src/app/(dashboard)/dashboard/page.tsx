import {
  ArrowRight,
  BookOpenCheck,
  ClipboardCheck,
  QrCode,
  Search,
  UserRoundCheck,
  Video,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireActiveUser } from "@/features/auth/server/auth";

const metrics = [
  { label: "VR İzleyenler", icon: Video },
  { label: "QR Dağıtılan", icon: QrCode },
  { label: "QR ile Kayıt Olan", icon: UserRoundCheck },
  { label: "Etkinliğe Gelen", icon: ClipboardCheck },
  { label: "Dil Kursuna Kayıt Olan", icon: BookOpenCheck },
];

const funnelSteps = [
  "VR İzledi",
  "QR Verildi",
  "QR Kayıt",
  "Etkinliğe Geldi",
  "Kursa Yazıldı",
];

export const dashboardQuickActions: Array<{ label: string; icon: LucideIcon; href: string }> = [
  { label: "Yeni VR Kaydı", icon: Video, href: "/dashboard/vr-records/new" },
  { label: "VR İzleyenler", icon: Search, href: "/dashboard/vr-records" },
  { label: "Etkinlik Katılımı", icon: ClipboardCheck, href: "/dashboard/attendance" },
];

function QuickActions() {

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {dashboardQuickActions.map(({ label, icon: Icon, href }) => (
        <Button
          key={label}
          variant="outline"
          className="h-auto justify-start gap-3 px-4 py-4"
          disabled={!href}
          asChild={Boolean(href)}
          title={href ? undefined : "Bu özellik yakında kullanıma açılacak"}
        >
          {href ? <Link href={href}><span className="grid size-9 place-items-center rounded-md bg-secondary text-foreground"><Icon aria-hidden="true" /></span><span className="text-left"><span className="block">{label}</span><span className="block text-xs font-normal text-muted-foreground">Aç</span></span></Link> : <><span className="grid size-9 place-items-center rounded-md bg-secondary text-foreground"><Icon aria-hidden="true" /></span><span className="text-left"><span className="block">{label}</span><span className="block text-xs font-normal text-muted-foreground">Yakında</span></span></>}
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
        <h2 id="quick-actions-title" className="mb-4 text-sm font-semibold">
          Hızlı işlemler
        </h2>
        <QuickActions />
      </section>
    </main>
  );
}

export default async function DashboardPage() {
  const user = await requireActiveUser();

  if (user.role === "STAFF") return <StaffDashboard fullName={user.fullName} />;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Badge variant="secondary">Yönetici görünümü</Badge>
          <h1 className="mt-3 text-3xl font-semibold">Genel Bakış</h1>
          <p className="mt-2 text-muted-foreground">
            Öğrenci dönüşüm sürecinin tüm adımlarını tek noktadan izleyin.
          </p>
        </div>
        <p className="text-sm text-muted-foreground">Veriler henüz bağlanmadı</p>
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5" aria-label="Dönüşüm metrikleri">
        {metrics.map(({ label, icon: Icon }) => (
          <Card key={label} className="gap-4 rounded-lg py-5 shadow-none">
            <CardHeader className="flex grid-cols-[1fr_auto] flex-row items-center justify-between gap-3 px-5">
              <CardDescription className="font-medium">{label}</CardDescription>
              <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-5">
              <p className="text-3xl font-semibold" aria-label={`${label}: veri yok`}>—</p>
              <p className="mt-2 text-xs text-muted-foreground">Veri bekleniyor</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.45fr_0.85fr]">
        <Card className="rounded-lg shadow-none">
          <CardHeader>
            <CardTitle>Dönüşüm hunisi</CardTitle>
            <CardDescription>Dönüşüm adımları veri bağlantısı sonrası burada izlenecek.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="grid gap-2 sm:grid-cols-5">
              {funnelSteps.map((step, index) => (
                <li key={step} className="flex items-center gap-2 sm:block">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full border text-xs font-medium">{index + 1}</span>
                  <span className="mt-2 block text-sm font-medium">{step}</span>
                  {index < funnelSteps.length - 1 ? <ArrowRight aria-hidden="true" className="ml-auto size-4 text-muted-foreground sm:mt-3 sm:rotate-0" /> : null}
                </li>
              ))}
            </ol>
            <div className="mt-6 rounded-md border border-dashed px-5 py-8 text-center">
              <p className="text-sm font-medium">Henüz dönüşüm verisi yok</p>
              <p className="mt-1 text-sm text-muted-foreground">Rapor sorguları sonraki aşamada bağlanacak.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg shadow-none">
          <CardHeader>
            <CardTitle>Son hareketler</CardTitle>
            <CardDescription>En güncel operasyon kayıtları</CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-52 items-center justify-center rounded-md">
            <div className="max-w-xs text-center">
              <ClipboardCheck aria-hidden="true" className="mx-auto size-6 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">Henüz hareket yok</p>
              <p className="mt-1 text-sm text-muted-foreground">VR ve QR kayıtları oluştuğunda burada görünecek.</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mt-6" aria-labelledby="quick-actions-title">
        <h2 id="quick-actions-title" className="mb-4 text-sm font-semibold">Hızlı işlemler</h2>
        <QuickActions />
      </section>
    </main>
  );
}
