import type { Metadata } from "next";
import { connection } from "next/server";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QrRegistrationForm } from "@/features/qr-registration/components/qr-registration-form";
import { QrRegistrationStatus } from "@/features/qr-registration/components/qr-registration-status";
import { getPublicQrStatus } from "@/features/qr-registration/queries/get-public-qr-status";
import { listActiveSchools } from "@/features/schools/queries/list-schools";

export const metadata: Metadata = {
  title: "Etkinlik Kayıt Formu | LeadBridge",
  robots: { index: false, follow: false },
};

export default async function PublicQrRegistrationPage({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  const [status, schools] = await Promise.all([getPublicQrStatus(token), listActiveSchools()]);

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-lg">
        <div className="mb-6 text-center"><p className="text-xl font-semibold">LeadBridge</p><p className="mt-1 text-sm text-muted-foreground">Etkinlik ve öğrenci kayıt sistemi</p></div>
        <Card className="rounded-lg shadow-sm">
          <CardHeader className="text-center"><CardTitle className="text-2xl">Etkinlik Kayıt Formu</CardTitle><p className="text-sm leading-6 text-muted-foreground">Kaydınızı tamamlamak için aşağıdaki bilgileri eksiksiz doldurun.</p></CardHeader>
          <CardContent>{status === "AVAILABLE" ? schools.length ? <QrRegistrationForm token={token} schools={schools} /> : <p className="py-8 text-center text-sm text-muted-foreground">Şu anda kayıt için kullanılabilir okul bulunmuyor.</p> : <QrRegistrationStatus status={status} />}</CardContent>
        </Card>
        <p className="mt-5 text-center text-xs leading-5 text-muted-foreground">Bilgileriniz yalnızca etkinlik ve kayıt süreçleri için kullanılır.</p>
      </div>
    </main>
  );
}
