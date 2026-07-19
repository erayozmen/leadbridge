import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/features/auth/server/auth";
import { GenerateQrCodesForm } from "@/features/qr-codes/components/generate-qr-codes-form";
import { QrCodeList } from "@/features/qr-codes/components/qr-code-list";
import { listQrCodes } from "@/features/qr-codes/queries/list-qr-codes";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function QrCodesPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const params = await searchParams;
  const filters = { serialNumber: first(params.serialNumber), status: first(params.status), createdFrom: first(params.createdFrom), createdTo: first(params.createdTo), archive: first(params.archive) };
  const result = await listQrCodes({ ...filters, page: Number(first(params.page)) });
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold">QR Kartları</h1><p className="mt-2 text-muted-foreground">Toplu kart üretin, CSV çıktısını indirin ve QR durumlarını yönetin.</p>
      <div className="mt-8 grid items-start gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <Card className="rounded-lg shadow-none xl:sticky xl:top-24"><CardHeader><CardTitle>Toplu QR Üretimi</CardTitle><CardDescription>Güvenli kayıt bağlantılarını tek seferlik CSV olarak oluşturun.</CardDescription></CardHeader><CardContent><GenerateQrCodesForm /></CardContent></Card>
        <Card className="gap-0 overflow-hidden rounded-lg py-0 shadow-none"><div className="p-5"><h2 className="font-semibold">QR kayıtları</h2><p className="mt-1 text-sm text-muted-foreground">En yeni kartlar önce gösterilir. Token ve hash değerleri görüntülenmez.</p></div><QrCodeList {...result} filters={filters} /></Card>
      </div>
    </main>
  );
}
