import { ArrowLeft, Search } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireAdmin } from "@/features/auth/server/auth";
import { AssignQrCodeButton } from "@/features/vr-records/components/assign-qr-code-button";
import { getVrRecordForQrAssignment, listAvailableQrCodes } from "@/features/vr-records/queries/list-available-qr-codes";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const formatter = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" });

function pageHref(id: string, page: number, serialNumber?: string) {
  const query = new URLSearchParams();
  if (serialNumber) query.set("serialNumber", serialNumber);
  if (page > 1) query.set("page", String(page));
  return `/dashboard/vr-records/${id}/assign-qr${query.size ? `?${query}` : ""}`;
}

export default async function AssignQrPage({ params, searchParams }: Props) {
  await requireAdmin();
  const { id } = await params;
  const student = await getVrRecordForQrAssignment(id);
  if (!student) notFound();
  if (student.assignedQrCodeId) redirect("/dashboard/vr-records");

  const query = await searchParams;
  const serialNumber = first(query.serialNumber);
  const result = await listAvailableQrCodes({ serialNumber, page: Number(first(query.page)) });
  const studentName = `${student.firstName} ${student.lastName}`;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <Button asChild variant="ghost" className="mb-5"><Link href="/dashboard/vr-records"><ArrowLeft />VR kayıtlarına dön</Link></Button>
      <div><Badge variant="secondary">Yalnızca Yönetici</Badge><h1 className="mt-3 text-3xl font-semibold">QR Kartı Ata</h1><p className="mt-2 text-muted-foreground">{studentName} · {student.school}</p></div>
      <Card className="mt-8 gap-0 overflow-hidden rounded-lg py-0 shadow-none">
        <CardHeader className="border-b py-5"><CardTitle>Uygun QR kartları</CardTitle></CardHeader>
        <CardContent className="px-0">
          <form method="get" className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-end">
            <div className="grid flex-1 gap-2"><Label htmlFor="serialNumber">Seri Numarası</Label><Input id="serialNumber" name="serialNumber" defaultValue={serialNumber} /></div>
            <Button type="submit"><Search />Ara</Button>
            {serialNumber ? <Button asChild variant="outline"><Link href={pageHref(id, 1)}>Temizle</Link></Button> : null}
          </form>
          {result.records.length === 0 ? <div className="p-10 text-center"><p className="font-medium">Uygun QR kartı bulunamadı</p><p className="mt-2 text-sm text-muted-foreground">Yalnızca oluşturulmuş ve henüz atanmamış kartlar burada görünür.</p></div> : <div className="divide-y">{result.records.map((qr) => <div key={qr.id} className="grid gap-4 p-5 md:grid-cols-[1fr_1.6fr] md:items-center"><div><p className="font-mono font-semibold">{qr.serialNumber}</p><p className="mt-1 text-sm text-muted-foreground">Oluşturulma: {formatter.format(qr.createdAt)}</p><Badge className="mt-2" variant="secondary">Oluşturuldu</Badge></div><AssignQrCodeButton vrRecordId={student.id} qrCodeId={qr.id} serialNumber={qr.serialNumber} studentName={studentName} /></div>)}</div>}
          <div className="flex items-center justify-between border-t p-5 text-sm"><p className="text-muted-foreground">Toplam {result.total} uygun kart · Sayfa {result.page}/{result.pageCount}</p><div className="flex gap-2"><Button asChild={result.page > 1} disabled={result.page <= 1} size="sm" variant="outline">{result.page > 1 ? <Link href={pageHref(id, result.page - 1, serialNumber)}>Önceki</Link> : <span>Önceki</span>}</Button><Button asChild={result.page < result.pageCount} disabled={result.page >= result.pageCount} size="sm" variant="outline">{result.page < result.pageCount ? <Link href={pageHref(id, result.page + 1, serialNumber)}>Sonraki</Link> : <span>Sonraki</span>}</Button></div></div>
        </CardContent>
      </Card>
    </main>
  );
}
