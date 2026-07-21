import { QrCodeStatus } from "@prisma/client";
import { Search } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArchiveAllDisabledQrCodesButton, ArchiveQrCodeButton } from "@/features/qr-codes/components/archive-qr-code-buttons";
import { DisableQrCodeButton } from "@/features/qr-codes/components/disable-qr-code-button";
import type { QrCodeFilters, QrCodeListItem } from "@/features/qr-codes/queries/list-qr-codes";
import { PageSizeSelect, SortSelect } from "@/components/shared/list-controls";

const labels: Record<QrCodeStatus, string> = { CREATED: "Oluşturuldu", ASSIGNED: "Atandı", USED: "Kullanıldı", DISABLED: "Devre Dışı" };
const dateFormatter = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" });

function pageHref(page: number, filters: QrCodeFilters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if ((typeof value === "string" && value) || (typeof value === "number" && value)) params.set(key, String(value));
  if (page > 1) params.set("page", String(page));
  return `/dashboard/qr-codes${params.size ? `?${params}` : ""}`;
}

export function QrCodeList({ records, total, page, pageCount, hasFilters, filters }: { records: QrCodeListItem[]; total: number; page: number; pageCount: number; hasFilters: boolean; filters: QrCodeFilters }) {
  return (
    <div>
      <form method="get" className="grid gap-4 border-b p-5 lg:grid-cols-3 xl:grid-cols-6 xl:items-end">
        <div className="grid gap-2"><Label htmlFor="serialNumber">Seri Numarası</Label><Input id="serialNumber" name="serialNumber" defaultValue={filters.serialNumber} /></div>
        <div className="grid gap-2"><Label htmlFor="status">Durum</Label><select id="status" name="status" defaultValue={filters.status ?? ""} className="h-9 rounded-md border bg-background px-3 text-sm"><option value="">Tümü</option>{Object.values(QrCodeStatus).map((status) => <option key={status} value={status}>{labels[status]}</option>)}</select></div>
        <div className="grid gap-2"><Label htmlFor="archive">Kayıt Görünümü</Label><select id="archive" name="archive" defaultValue={filters.archive ?? "active"} className="h-9 rounded-md border bg-background px-3 text-sm"><option value="active">Aktif Kayıtlar</option><option value="archived">Arşivlenenler</option><option value="all">Tümü</option></select></div>
        <div className="grid gap-2"><Label htmlFor="createdFrom">Başlangıç</Label><Input id="createdFrom" name="createdFrom" type="date" defaultValue={filters.createdFrom} /></div>
        <div className="grid gap-2"><Label htmlFor="createdTo">Bitiş</Label><Input id="createdTo" name="createdTo" type="date" defaultValue={filters.createdTo} /></div>
        <SortSelect value={filters.sort} /><PageSizeSelect value={filters.pageSize} />
        <div className="flex gap-2"><Button type="submit"><Search />Ara</Button>{hasFilters ? <Button asChild variant="outline"><Link href="/dashboard/qr-codes">Temizle</Link></Button> : null}</div>
      </form>
      <div className="border-b p-5"><ArchiveAllDisabledQrCodesButton /></div>
      {records.length === 0 ? <div className="grid min-h-72 place-items-center p-8 text-center"><div><Search className="mx-auto size-7 text-muted-foreground" /><p className="mt-4 font-medium">{hasFilters ? "Eşleşen QR kartı bulunamadı" : "Henüz QR kartı yok"}</p><p className="mt-2 text-sm text-muted-foreground">{hasFilters ? "Filtreleri değiştirerek tekrar arayın." : "İlk kart grubunu üretim formundan oluşturabilirsiniz."}</p></div></div> : (
        <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead className="pl-5">Seri</TableHead><TableHead>Durum</TableHead><TableHead>Oluşturulma</TableHead><TableHead>Atanma</TableHead><TableHead>Kullanılma</TableHead><TableHead>Arşivlenme</TableHead><TableHead>VR Öğrencisi</TableHead><TableHead>Kayıtlı Öğrenci</TableHead><TableHead className="pr-5">İşlem</TableHead></TableRow></TableHeader><TableBody>{records.map((record) => <TableRow key={record.id}><TableCell className="pl-5 font-mono font-medium">{record.serialNumber}</TableCell><TableCell><Badge variant={record.archivedAt || record.status === QrCodeStatus.DISABLED ? "outline" : "secondary"}>{record.archivedAt ? "Arşivlendi" : labels[record.status]}</Badge></TableCell><TableCell>{dateFormatter.format(record.createdAt)}</TableCell><TableCell>{record.assignedAt ? dateFormatter.format(record.assignedAt) : "—"}</TableCell><TableCell>{record.usedAt ? dateFormatter.format(record.usedAt) : "—"}</TableCell><TableCell>{record.archivedAt ? dateFormatter.format(record.archivedAt) : "—"}</TableCell><TableCell>{record.assignedVrRecord ? `${record.assignedVrRecord.firstName} ${record.assignedVrRecord.lastName}` : "—"}</TableCell><TableCell>{record.qrRegistration ? `${record.qrRegistration.firstName} ${record.qrRegistration.lastName}` : "—"}</TableCell><TableCell className="pr-5">{!record.archivedAt && record.status === QrCodeStatus.CREATED ? <DisableQrCodeButton id={record.id} /> : !record.archivedAt && record.status === QrCodeStatus.DISABLED && !record.assignedVrRecord && !record.qrRegistration ? <ArchiveQrCodeButton id={record.id} /> : "—"}</TableCell></TableRow>)}</TableBody></Table></div>
      )}
      <div className="flex flex-col gap-3 border-t p-5 text-sm sm:flex-row sm:items-center sm:justify-between"><p className="text-muted-foreground">Toplam {total} kayıt · Sayfa {page}/{pageCount}</p><div className="flex gap-2"><Button variant="outline" size="sm" asChild={page > 1} disabled={page <= 1}>{page > 1 ? <Link href={pageHref(page - 1, filters)}>Önceki</Link> : <span>Önceki</span>}</Button><Button variant="outline" size="sm" asChild={page < pageCount} disabled={page >= pageCount}>{page < pageCount ? <Link href={pageHref(page + 1, filters)}>Sonraki</Link> : <span>Sonraki</span>}</Button></div></div>
    </div>
  );
}
