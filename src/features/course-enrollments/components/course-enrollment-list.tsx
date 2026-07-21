import type { UserRole } from "@prisma/client";
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
import { MarkCourseEnrollmentButton } from "@/features/course-enrollments/components/mark-course-enrollment-button";
import { ReverseCourseEnrollmentButton } from "@/features/course-enrollments/components/reverse-course-enrollment-button";
import { canReverseCourseEnrollment } from "@/features/course-enrollments/lib/course-enrollment-permissions";
import type {
  CourseEnrollmentFilters,
  CourseEnrollmentListItem,
} from "@/features/course-enrollments/queries/list-course-enrollments";
import type { StudentEligibility } from "@/features/course-enrollments/lib/language-school-selection";
import { PageSizeSelect, SortSelect } from "@/components/shared/list-controls";

const date = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" });

function href(page: number, filters: CourseEnrollmentFilters) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if ((typeof value === "string" && value) || (typeof value === "number" && value)) query.set(key, String(value));
  }
  if (page > 1) query.set("page", String(page));
  return `/dashboard/course-enrollments${query.size ? `?${query}` : ""}`;
}

type Props = {
  records: CourseEnrollmentListItem[];
  total: number;
  page: number;
  pageCount: number;
  hasFilters: boolean;
  filters: CourseEnrollmentFilters;
  schools: Array<{ id: string; name: string }>;
  eligibilityById: ReadonlyMap<string, StudentEligibility>;
  selectedIds: ReadonlySet<string>;
  selectionWarning: string | null;
  onToggleSelection: (id: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  userRole: UserRole;
};

export function CourseEnrollmentList({
  records,
  total,
  page,
  pageCount,
  hasFilters,
  filters,
  schools,
  eligibilityById,
  selectedIds,
  selectionWarning,
  onToggleSelection,
  onSelectAll,
  onClearSelection,
  userRole,
}: Props) {
  const selectableCount = records.filter((record) => eligibilityById.get(record.id)?.eligible).length;

  return (
    <div>
      <form method="get" className="grid gap-4 border-b p-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="grid gap-2">
          <Label htmlFor="course-first">Ad</Label>
          <Input id="course-first" name="firstName" defaultValue={filters.firstName} />
        </div>
        <SortSelect value={filters.sort} /><PageSizeSelect value={filters.pageSize} />
        <div className="grid gap-2">
          <Label htmlFor="course-last">Soyad</Label>
          <Input id="course-last" name="lastName" defaultValue={filters.lastName} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="course-school">Okul</Label>
          <select
            id="course-school"
            name="schoolId"
            defaultValue={filters.schoolId ?? ""}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">Tümü</option>
            {schools.map((school) => (
              <option key={school.id} value={school.id}>{school.name}</option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="course-phone">Telefon</Label>
          <Input id="course-phone" name="phone" defaultValue={filters.phone} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="course-attendance">Etkinlik Katılımı</Label>
          <select
            id="course-attendance"
            name="attendance"
            defaultValue={filters.attendance ?? ""}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">Tümü</option>
            <option value="attended">Katıldı</option>
            <option value="not-attended">Katılmadı</option>
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="course-enrollment">Kurs Kaydı</Label>
          <select
            id="course-enrollment"
            name="enrollment"
            defaultValue={filters.enrollment ?? ""}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">Tümü</option>
            <option value="enrolled">Kayıtlı</option>
            <option value="not-enrolled">Kayıtlı Değil</option>
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="course-from">Kayıt Başlangıcı</Label>
          <Input id="course-from" name="registeredFrom" type="date" defaultValue={filters.registeredFrom} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="course-to">Kayıt Bitişi</Label>
          <Input id="course-to" name="registeredTo" type="date" defaultValue={filters.registeredTo} />
        </div>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
          <Button><Search />Ara</Button>
          {hasFilters ? <Button asChild variant="outline"><Link href="/dashboard/course-enrollments">Temizle</Link></Button> : null}
        </div>
      </form>

      {records.length ? (
        <>
          <div className="flex flex-col gap-3 border-b bg-muted/20 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Toplu doğrulama seçimi</p>
              <p className="text-xs text-muted-foreground">Bu sayfada {selectableCount} kayıt sorgulanabilir.</p>
            </div>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={onSelectAll} disabled={!selectableCount}>
                Tümünü Seç
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={onClearSelection} disabled={!selectedIds.size}>
                Seçimi Kaldır
              </Button>
            </div>
          </div>
          {selectionWarning ? (
            <p className="border-b bg-amber-50 px-5 py-3 text-sm text-amber-900" role="alert">
              {selectionWarning}
            </p>
          ) : null}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 pl-5"><span className="sr-only">Seçim</span></TableHead>
                  <TableHead>Öğrenci</TableHead>
                  <TableHead>Okul / Veli</TableHead>
                  <TableHead>QR Kaydı</TableHead>
                  <TableHead>VR</TableHead>
                  <TableHead>Etkinlik</TableHead>
                  <TableHead>Kurs Kaydı</TableHead>
                  <TableHead className="pr-5">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => {
                  const eligibility = eligibilityById.get(record.id);
                  const selectable = eligibility?.eligible === true;
                  const reason = eligibility && !eligibility.eligible ? eligibility.reason : undefined;
                  return (
                    <TableRow key={record.id}>
                      <TableCell className="pl-5 align-top">
                        <input
                          type="checkbox"
                          className="size-4 accent-primary"
                          checked={selectedIds.has(record.id)}
                          disabled={!selectable}
                          onChange={() => onToggleSelection(record.id)}
                          aria-label={`${record.firstName} ${record.lastName} kaydını seç`}
                          aria-describedby={reason ? `selection-reason-${record.id}` : undefined}
                        />
                      </TableCell>
                      <TableCell className="min-w-48 align-top">
                        <p className="font-medium">{record.firstName} {record.lastName}</p>
                        <p className="text-sm text-muted-foreground">{record.phone || "—"}</p>
                        {reason ? <p id={`selection-reason-${record.id}`} className="mt-1 text-xs text-amber-700">{reason}</p> : null}
                      </TableCell>
                      <TableCell><p>{record.school}</p><p className="text-sm text-muted-foreground">Veli: {record.guardianName}</p></TableCell>
                      <TableCell><p className="font-mono text-xs">{record.qrCode.serialNumber}</p><p className="text-xs text-muted-foreground">{date.format(record.registeredAt)}</p></TableCell>
                      <TableCell><Badge variant={record.studentMatch ? "default" : "secondary"}>{record.studentMatch ? "Eşleşti" : "Eşleşmedi"}</Badge></TableCell>
                      <TableCell><Badge variant={record.attendedEvent ? "default" : "secondary"}>{record.attendedEvent ? "Katıldı" : "Katılmadı"}</Badge></TableCell>
                      <TableCell>{record.enrolledCourse ? <div><Badge>Kursa Kayıtlı</Badge><p className="mt-1 text-xs text-muted-foreground">{record.enrolledAt ? date.format(record.enrolledAt) : "—"}</p><p className="text-xs text-muted-foreground">{record.enrolledByUser?.fullName ?? "—"}</p></div> : <Badge variant="secondary">Kayıtlı Değil</Badge>}</TableCell>
                      <TableCell className="min-w-60 pr-5">
                        {record.enrolledCourse ? (
                          canReverseCourseEnrollment(userRole, record.enrolledCourse) ? (
                            <ReverseCourseEnrollmentButton
                              id={record.id}
                              studentName={`${record.firstName} ${record.lastName}`}
                            />
                          ) : "—"
                        ) : (
                          <MarkCourseEnrollmentButton
                            id={record.id}
                            studentName={`${record.firstName} ${record.lastName}`}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      ) : (
        <div className="p-12 text-center">
          {hasFilters ? "Filtrelerle eşleşen öğrenci bulunamadı." : "Henüz QR üzerinden kayıt olmuş öğrenci yok."}
        </div>
      )}

      <div className="flex justify-between border-t p-5 text-sm">
        <span>Toplam {total} · Sayfa {page}/{pageCount}</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" asChild={page > 1} disabled={page <= 1}>{page > 1 ? <Link href={href(page - 1, filters)}>Önceki</Link> : <span>Önceki</span>}</Button>
          <Button size="sm" variant="outline" asChild={page < pageCount} disabled={page >= pageCount}>{page < pageCount ? <Link href={href(page + 1, filters)}>Sonraki</Link> : <span>Sonraki</span>}</Button>
        </div>
      </div>
    </div>
  );
}
