import { UserRole } from "@prisma/client";
import { Search } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MarkAttendanceButton } from "@/features/attendance/components/mark-attendance-button";
import { ReverseAttendanceButton } from "@/features/attendance/components/reverse-attendance-button";
import {
  canMarkAttendance,
  canReverseAttendance,
} from "@/features/attendance/lib/attendance-permissions";
import type {
  AttendanceFilters,
  AttendanceListItem,
} from "@/features/attendance/queries/list-attendance-registrations";
import { PageSizeSelect, SortSelect } from "@/components/shared/list-controls";

const date = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium",
  timeStyle: "short",
});

function href(page: number, filters: AttendanceFilters) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if ((typeof value === "string" && value) || (typeof value === "number" && value)) query.set(key, String(value));
  }
  if (page > 1) query.set("page", String(page));
  return `/dashboard/attendance${query.size ? `?${query}` : ""}`;
}

type AttendanceListProps = {
  records: AttendanceListItem[];
  total: number;
  page: number;
  pageCount: number;
  hasFilters: boolean;
  filters: AttendanceFilters;
  userRole: UserRole;
};

export function AttendanceList({
  records,
  total,
  page,
  pageCount,
  hasFilters,
  filters,
  userRole,
}: AttendanceListProps) {
  return (
    <div>
      <form
        method="get"
        className="grid gap-4 border-b p-5 lg:grid-cols-[1fr_1fr_1.2fr_1fr_auto] lg:items-end"
      >
        {[
          ["firstName", "Ad"],
          ["lastName", "Soyad"],
          ["school", "Okul"],
          ["phone", "Telefon"],
        ].map(([key, label]) => (
          <div key={key} className="grid gap-2">
            <Label htmlFor={`attendance-${key}`}>{label}</Label>
            <Input
              id={`attendance-${key}`}
              name={key}
              defaultValue={filters[key as keyof AttendanceFilters] as string | undefined}
            />
          </div>
        ))}
        <div className="grid gap-2"><Label htmlFor="attendance-status">Katılım</Label><select id="attendance-status" name="attendance" defaultValue={filters.attendance??""} className="h-9 rounded-md border bg-background px-3 text-sm"><option value="">Tümü</option><option value="attended">Katıldı</option><option value="not-attended">Katılmadı</option></select></div>
        <SortSelect value={filters.sort} /><PageSizeSelect value={filters.pageSize} />
        <div className="flex gap-2">
          <Button type="submit"><Search />Ara</Button>
          {hasFilters ? <Button asChild variant="outline"><Link href="/dashboard/attendance">Temizle</Link></Button> : null}
        </div>
      </form>
      {records.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">Öğrenci</TableHead>
              <TableHead>Okul / Veli</TableHead>
              <TableHead>QR Bilgisi</TableHead>
              <TableHead>VR Eşleşmesi</TableHead>
              <TableHead>Katılım</TableHead>
              <TableHead className="pr-5">İşlem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((record) => {
              const studentName = `${record.firstName} ${record.lastName}`;
              return (
                <TableRow key={record.id}>
                  <TableCell className="pl-5">
                    <p className="font-medium">{studentName}</p>
                    <p className="text-sm text-muted-foreground">{record.phone}</p>
                  </TableCell>
                  <TableCell>
                    <p>{record.school}</p>
                    <p className="text-sm text-muted-foreground">Veli: {record.guardianName}</p>
                  </TableCell>
                  <TableCell>
                    <p className="font-mono text-xs">{record.qrCode.serialNumber}</p>
                    <p className="text-xs text-muted-foreground">{date.format(record.registeredAt)}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant={record.studentMatch ? "default" : "secondary"}>
                      {record.studentMatch ? "VR ile Eşleşti" : "Eşleşmedi"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {record.attendedEvent ? (
                      <div>
                        <Badge>Katıldı</Badge>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {record.attendedAt ? date.format(record.attendedAt) : "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {record.attendedByUser?.fullName ?? "—"}
                        </p>
                      </div>
                    ) : <Badge variant="secondary">Katılmadı</Badge>}
                  </TableCell>
                  <TableCell className="min-w-56 pr-5">
                    {canMarkAttendance(record.attendedEvent) ? (
                      <MarkAttendanceButton id={record.id} studentName={studentName} />
                    ) : canReverseAttendance(userRole, record.attendedEvent) ? (
                      <ReverseAttendanceButton id={record.id} studentName={studentName} />
                    ) : "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : (
        <div className="p-12 text-center">
          {hasFilters
            ? "Aramayla eşleşen öğrenci bulunamadı."
            : "Henüz QR üzerinden kayıt olmuş öğrenci yok."}
        </div>
      )}
      <div className="flex flex-col gap-3 border-t p-5 text-sm sm:flex-row sm:justify-between">
        <span>Toplam {total} · Sayfa {page}/{pageCount}</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" asChild={page > 1} disabled={page <= 1}>
            {page > 1 ? <Link href={href(page - 1, filters)}>Önceki</Link> : <span>Önceki</span>}
          </Button>
          <Button size="sm" variant="outline" asChild={page < pageCount} disabled={page >= pageCount}>
            {page < pageCount ? <Link href={href(page + 1, filters)}>Sonraki</Link> : <span>Sonraki</span>}
          </Button>
        </div>
      </div>
    </div>
  );
}
