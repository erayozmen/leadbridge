import { ArrowRight, UserRoundPlus } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireStaffOrAdmin } from "@/features/auth/server/auth";
import { VrRecordForm } from "@/features/vr-records/components/vr-record-form";
import { listActiveSchools } from "@/features/schools/queries/list-schools";
import { prisma } from "@/lib/prisma";

export default async function NewVrRecordPage() {
  await requireStaffOrAdmin();
  const [schools, events] = await Promise.all([
    listActiveSchools(),
    prisma.event.findMany({ where: { OR: [{ status: "ACTIVE" }, { id: "leadbridge-legacy-event", status: "COMPLETED" }] }, select: { id: true, name: true }, orderBy: { eventDate: "desc" } }),
  ]);
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader icon={UserRoundPlus} title="Yeni VR Kaydı" description="VR deneyimine katılan öğrencinin bilgilerini hızlıca kaydedin." />
      <Card className="mt-8 rounded-lg shadow-none">
        <CardHeader><CardTitle>Yeni öğrenci kaydı</CardTitle><CardDescription>Zorunlu alanları doldurarak kaydı tamamlayın.</CardDescription></CardHeader>
        <CardContent className="space-y-5">{schools.length ? <VrRecordForm schools={schools} events={events} /> : <div className="rounded-md border border-dashed p-5 text-sm text-muted-foreground">Aktif okul bulunmuyor. Kayıt oluşturabilmek için bir yöneticinin önce Okullar ekranından aktif okul eklemesi gerekir.</div>}<Button asChild variant="outline" className="w-full"><Link href="/dashboard/vr-records">VR İzleyenlere Git<ArrowRight aria-hidden="true" /></Link></Button></CardContent>
      </Card>
    </main>
  );
}
