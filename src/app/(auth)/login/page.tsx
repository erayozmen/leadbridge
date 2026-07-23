import { ArrowRight, CheckCircle2, QrCode, ShieldCheck, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/features/auth/components/login-form";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen bg-[#f4f7f9] lg:grid-cols-[minmax(0,1fr)_32rem]">
      <section className="relative hidden overflow-hidden bg-[#092f35] p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-16">
        <div aria-hidden="true" className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgb(255_255_255/0.08)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.07)_1px,transparent_1px)] [background-size:42px_42px]" />
        <div className="relative flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-md bg-emerald-300 font-semibold text-emerald-950 shadow-lg">LB</span>
          <div>
            <p className="text-xl font-semibold">LeadBridge</p>
            <p className="mt-1 text-xs text-white/55">Öğrenci dönüşüm platformu</p>
          </div>
        </div>
        <div className="relative max-w-2xl">
          <Badge className="border-emerald-200/20 bg-emerald-200/10 text-emerald-100 hover:bg-emerald-200/10">
            <Sparkles aria-hidden="true" />
            Operasyon merkezi
          </Badge>
          <h1 className="mt-6 text-4xl font-semibold leading-tight text-balance xl:text-5xl">
            Öğrenci yolculuğunu ilk temastan kayda kadar yönetin.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-white/60">
            VR deneyimleri, QR kayıtları ve etkinlik katılımını düzenli bir operasyon akışında birleştirin.
          </p>
          <div className="mt-9 grid max-w-xl gap-3 sm:grid-cols-3">
            {[
              [QrCode, "QR tabanlı kayıt"],
              [CheckCircle2, "Uçtan uca takip"],
              [ShieldCheck, "Güvenli işlemler"],
            ].map(([Icon, label]) => (
              <div key={String(label)} className="rounded-md border border-white/10 bg-white/6 p-4">
                <Icon aria-hidden="true" className="size-4 text-emerald-300" />
                <p className="mt-3 text-xs font-medium text-white/75">{String(label)}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-white/40">LeadBridge yönetim sistemi</p>
      </section>

      <section className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="grid size-10 place-items-center rounded-md bg-primary font-semibold text-primary-foreground shadow-md">LB</span>
            <div>
              <p className="text-xl font-semibold">LeadBridge</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Öğrenci dönüşüm platformu</p>
            </div>
          </div>
          <Card className="gap-7 border-white/80 bg-white/90 px-1 py-8 shadow-[0_24px_70px_rgb(15_23_42/0.10)] sm:px-3">
            <CardHeader>
              <Badge variant="secondary" className="mb-1">Güvenli giriş <ArrowRight aria-hidden="true" /></Badge>
              <CardTitle className="text-2xl sm:text-3xl">Hesabınıza giriş yapın</CardTitle>
              <p className="text-sm leading-6 text-muted-foreground">Yönetim paneline devam etmek için kurumsal hesabınızı kullanın.</p>
            </CardHeader>
            <CardContent><LoginForm /></CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
