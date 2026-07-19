import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/features/auth/components/login-form";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-[1fr_30rem]">
      <section className="hidden border-r bg-foreground p-12 text-background lg:flex lg:flex-col lg:justify-between">
        <div>
          <p className="text-xl font-semibold">LeadBridge</p>
          <p className="mt-2 text-sm text-background/65">Öğrenci Dönüşüm ve Etkinlik Takip Sistemi</p>
        </div>
        <div className="max-w-xl">
          <Badge className="bg-background/10 text-background hover:bg-background/10">Operasyon merkezi</Badge>
          <h1 className="mt-6 text-4xl font-semibold leading-tight">
            Öğrenci yolculuğunu ilk temastan kayda kadar yönetin.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-background/65">
            VR deneyimleri, QR kayıtları ve etkinlik katılımını düzenli bir operasyon akışında birleştirin.
          </p>
        </div>
        <p className="text-xs text-background/50">LeadBridge yönetim sistemi</p>
      </section>

      <section className="flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-sm">
          <div className="mb-10 lg:hidden">
            <p className="text-xl font-semibold">LeadBridge</p>
            <p className="mt-1 text-sm text-muted-foreground">Öğrenci Dönüşüm ve Etkinlik Takip Sistemi</p>
          </div>
          <Card className="gap-7 rounded-lg border-0 py-0 shadow-none">
            <CardHeader className="px-0">
              <CardTitle className="text-2xl">Hesabınıza giriş yapın</CardTitle>
              <p className="text-sm leading-6 text-muted-foreground">Yönetim paneline devam etmek için kurumsal hesabınızı kullanın.</p>
            </CardHeader>
            <CardContent className="px-0"><LoginForm /></CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
