import { QrCodeStatus } from "@prisma/client";
import { Search } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { canManageStudentMatches } from "@/features/student-matching/lib/student-match-permissions";
import { UnassignQrCodeButton } from "@/features/vr-records/components/unassign-qr-code-button";
import { canAssignQrCode } from "@/features/vr-records/lib/qr-assignment-permissions";
import { canUnassignQrCode } from "@/features/vr-records/lib/qr-unassignment-permissions";
import type { VrRecordFilters, VrRecordListItem } from "@/features/vr-records/queries/list-vr-records";

type ListProps = {
  records: VrRecordListItem[]; page: number; pageCount: number; total: number; hasFilters: boolean; filters: VrRecordFilters;
  options: { schools: Array<{ id: string; name: string }>; creators: Array<{ id: string; fullName: string }> }; role: "ADMIN" | "STAFF";
};
const dateFormatter = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" });
const qrStatusLabels: Record<QrCodeStatus, string> = { CREATED: "Oluşturuldu", ASSIGNED: "Atandı", USED: "Kullanıldı", DISABLED: "Devre Dışı" };

function pageHref(page: number, filters: VrRecordFilters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (typeof value === "string" && value) params.set(key, value);
  if (page > 1) params.set("page", String(page));
  return `/dashboard/vr-records${params.size ? `?${params}` : ""}`;
}

export function VrRecordList({ records, page, pageCount, total, hasFilters, filters, options, role }: ListProps) {
  return (
    <div>
      <form method="get" className="grid gap-4 border-b px-5 py-5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 xl:items-end">
        <div className="grid gap-2"><Label htmlFor="filter-first-name">Ad</Label><Input id="filter-first-name" name="firstName" defaultValue={filters.firstName} maxLength={80} /></div>
        <div className="grid gap-2"><Label htmlFor="filter-last-name">Soyad</Label><Input id="filter-last-name" name="lastName" defaultValue={filters.lastName} maxLength={80} /></div>
        <div className="grid gap-2"><Label htmlFor="filter-school">Okul</Label><select id="filter-school" name="schoolId" defaultValue={filters.schoolId ?? ""} className="h-9 rounded-md border bg-background px-3 text-sm"><option value="">Tümü</option>{options.schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></div>
        <div className="grid gap-2"><Label htmlFor="filter-created-from">Başlangıç Tarihi</Label><Input id="filter-created-from" name="createdFrom" type="date" defaultValue={filters.createdFrom} /></div>
        <div className="grid gap-2"><Label htmlFor="filter-created-to">Bitiş Tarihi</Label><Input id="filter-created-to" name="createdTo" type="date" defaultValue={filters.createdTo} /></div>
        <div className="grid gap-2"><Label htmlFor="filter-creator">Kaydı Oluşturan</Label><select id="filter-creator" name="createdByUserId" defaultValue={filters.createdByUserId ?? ""} className="h-9 rounded-md border bg-background px-3 text-sm"><option value="">Tümü</option>{options.creators.map((creator) => <option key={creator.id} value={creator.id}>{creator.fullName}</option>)}</select></div>
        <div className="grid gap-2"><Label htmlFor="filter-qr-status">QR Durumu</Label><select id="filter-qr-status" name="qrStatus" defaultValue={filters.qrStatus ?? ""} className="h-9 rounded-md border bg-background px-3 text-sm"><option value="">Tümü</option><option value="UNASSIGNED">QR Atanmadı</option>{Object.values(QrCodeStatus).map((status) => <option key={status} value={status}>{qrStatusLabels[status]}</option>)}</select></div>
        <div className="grid gap-2"><Label htmlFor="filter-match-status">Eşleşme Durumu</Label><select id="filter-match-status" name="matchStatus" defaultValue={filters.matchStatus ?? ""} className="h-9 rounded-md border bg-background px-3 text-sm"><option value="">Tümü</option><option value="matched">Eşleşti</option><option value="unmatched">Eşleşmedi</option></select></div>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-4 xl:col-span-2"><Button type="submit"><Search aria-hidden="true" />Ara</Button>{hasFilters ? <Button variant="outline" asChild><Link href="/dashboard/vr-records">Temizle</Link></Button> : null}</div>
      </form>
      {records.length === 0 ? <div className="grid min-h-72 place-items-center px-6 py-12 text-center"><div className="max-w-sm"><Search aria-hidden="true" className="mx-auto size-7 text-muted-foreground" /><p className="mt-4 font-medium">{hasFilters ? "Filtrelerle eşleşen kayıt bulunamadı" : "Henüz VR kaydı yok"}</p><p className="mt-2 text-sm leading-6 text-muted-foreground">{hasFilters ? "Filtreleri değiştirerek yeniden arayın veya tüm kayıtları görüntüleyin." : "Yeni kayıtları VR Kaydı ekranından ekleyebilirsiniz."}</p></div></div> : (
        <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead className="pl-5">Ad Soyad</TableHead><TableHead>Okul</TableHead><TableHead>Telefon</TableHead><TableHead>Oluşturan</TableHead><TableHead>Kayıt Tarihi</TableHead><TableHead>QR Durumu</TableHead><TableHead>QR İşlemi</TableHead><TableHead className="pr-5">Eşleşme</TableHead></TableRow></TableHeader><TableBody>{records.map((record) => <TableRow key={record.id}><TableCell className="pl-5 font-medium">{record.firstName} {record.lastName}</TableCell><TableCell>{record.school}</TableCell><TableCell>{record.phone ?? "—"}</TableCell><TableCell>{record.createdByUser.fullName}</TableCell><TableCell>{dateFormatter.format(record.createdAt)}</TableCell><TableCell>{record.assignedQrCode ? <div className="space-y-1"><Badge>{qrStatusLabels[record.assignedQrCode.status]}</Badge><p className="font-mono text-xs">{record.assignedQrCode.serialNumber}</p><p className="text-xs text-muted-foreground">{record.assignedQrCode.assignedAt ? dateFormatter.format(record.assignedQrCode.assignedAt) : "Atanma tarihi yok"}</p></div> : <Badge variant="secondary">QR Atanmadı</Badge>}</TableCell><TableCell>{!record.assignedQrCode && canAssignQrCode(role) ? <Button asChild size="sm" variant="outline"><Link href={`/dashboard/vr-records/${record.id}/assign-qr`}>QR Ata</Link></Button> : record.assignedQrCode && canUnassignQrCode({ role, status: record.assignedQrCode.status, usedAt: record.assignedQrCode.usedAt, archivedAt: record.assignedQrCode.archivedAt, hasRegistration: Boolean(record.assignedQrCode.qrRegistration), hasStudentMatch: Boolean(record.studentMatch) }) ? <UnassignQrCodeButton vrRecordId={record.id} qrCodeId={record.assignedQrCode.id} serialNumber={record.assignedQrCode.serialNumber} studentName={`${record.firstName} ${record.lastName}`} /> : "—"}</TableCell><TableCell className="pr-5">{record.studentMatch ? <div className="space-y-1"><Badge>Eşleşti</Badge><p className="text-xs">{record.studentMatch.qrRegistration.firstName} {record.studentMatch.qrRegistration.lastName}</p><p className="text-xs text-muted-foreground">{dateFormatter.format(record.studentMatch.matchedAt)}</p>{canManageStudentMatches(role) ? <Button asChild size="sm" variant="link"><Link href={`/dashboard/vr-records/${record.id}/match-registration`}>Yönet</Link></Button> : null}</div> : canManageStudentMatches(role) ? <Button asChild size="sm" variant="outline"><Link href={`/dashboard/vr-records/${record.id}/match-registration`}>QR Kaydıyla Eşleştir</Link></Button> : <Badge variant="secondary">Eşleşmedi</Badge>}</TableCell></TableRow>)}</TableBody></Table></div>
      )}
      <div className="flex flex-col gap-3 border-t px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between"><p className="text-muted-foreground">Toplam {total} kayıt · Sayfa {page}/{pageCount}</p><div className="flex gap-2"><Button variant="outline" size="sm" asChild={page > 1} disabled={page <= 1}>{page > 1 ? <Link href={pageHref(page - 1, filters)}>Önceki</Link> : <span>Önceki</span>}</Button><Button variant="outline" size="sm" asChild={page < pageCount} disabled={page >= pageCount}>{page < pageCount ? <Link href={pageHref(page + 1, filters)}>Sonraki</Link> : <span>Sonraki</span>}</Button></div></div>
    </div>
  );
}
