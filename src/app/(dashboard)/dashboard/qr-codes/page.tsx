import { QrCode } from "lucide-react";
import { DashboardPage, DashboardSection } from "@/components/dashboard/dashboard-page";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/features/auth/server/auth";
import { requireSelectedEvent } from "@/features/events/server/event-context";
import { GenerateQrCodesForm } from "@/features/qr-codes/components/generate-qr-codes-form";
import { QrCodeList } from "@/features/qr-codes/components/qr-code-list";
import { listQrCodes } from "@/features/qr-codes/queries/list-qr-codes";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
export default async function QrCodesPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const event = await requireSelectedEvent();
  const params = await searchParams;
  const filters = { serialNumber: first(params.serialNumber), status: first(params.status), createdFrom: first(params.createdFrom), createdTo: first(params.createdTo), archive: first(params.archive), sort: first(params.sort), pageSize: Number(first(params.pageSize)) };
  const result = await listQrCodes({ ...filters, eventId: event.id, page: Number(first(params.page)) });
  return <DashboardPage>
    <PageHeader icon={QrCode} title="QR Kartları" description="Toplu kart üretin, CSV çıktısını indirin ve QR durumlarını yönetin." />
    <DashboardSection className="grid min-w-0 items-start gap-6 2xl:grid-cols-[22rem_minmax(0,1fr)]">
      <Card className="2xl:sticky 2xl:top-24"><CardHeader><CardTitle>Toplu QR üretimi</CardTitle><CardDescription>Güvenli kayıt bağlantılarını tek seferlik CSV olarak oluşturun.</CardDescription></CardHeader><CardContent><GenerateQrCodesForm /></CardContent></Card>
      <Card className="gap-0 overflow-hidden py-0"><div className="border-b border-border/70 p-5 sm:p-6"><h2 className="font-semibold">QR kayıtları</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">En yeni kartlar önce gösterilir. Token ve hash değerleri görüntülenmez.</p></div><QrCodeList {...result} filters={filters} /></Card>
    </DashboardSection>
  </DashboardPage>;
}
