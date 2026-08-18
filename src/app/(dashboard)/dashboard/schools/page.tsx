import { SchoolStatus } from "@prisma/client";
import { School, Search } from "lucide-react";
import Link from "next/link";
import { DashboardPage, DashboardSection } from "@/components/dashboard/dashboard-page";
import { PageHeader } from "@/components/dashboard/page-header";
import { DataEmptyState, DataPagination, FilterToolbar } from "@/components/shared/data-surface";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdmin } from "@/features/auth/server/auth";
import { CreateSchoolForm, SchoolStatusButton, UpdateSchoolForm } from "@/features/schools/components/school-forms";
import { listSchools } from "@/features/schools/queries/list-schools";

const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const date = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" });

export default async function SchoolsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const params = await searchParams;
  const filters = { name: first(params.name), status: first(params.status), sort: first(params.sort), pageSize: Number(first(params.pageSize)) };
  const result = await listSchools({ ...filters, page: Number(first(params.page)) });
  const href = (page: number) => {
    const query = new URLSearchParams();
    if (filters.name) query.set("name", filters.name);
    if (filters.status) query.set("status", filters.status);
    if (page > 1) query.set("page", String(page));
    return `/dashboard/schools${query.size ? `?${query}` : ""}`;
  };
  return <DashboardPage>
    <PageHeader icon={School} title="Okullar" description="Kayıtlarda kullanılacak okul adlarını merkezi olarak yönetin." />
    <DashboardSection className="grid min-w-0 items-start gap-6 2xl:grid-cols-[22rem_minmax(0,1fr)]">
      <Card><CardHeader><CardTitle>Yeni okul</CardTitle><CardDescription>Yeni kayıtlarda seçilebilecek bir okul ekleyin.</CardDescription></CardHeader><CardContent><CreateSchoolForm /></CardContent></Card>
      <Card className="gap-0 overflow-hidden py-0">
        <FilterToolbar method="get" className="sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-end">
          <div className="grid gap-2"><Label htmlFor="school-search">Okul adı</Label><Input id="school-search" name="name" defaultValue={filters.name} /></div>
          <div className="grid gap-2"><Label htmlFor="school-status">Durum</Label><select id="school-status" name="status" defaultValue={filters.status ?? ""}><option value="">Tümü</option><option value="ACTIVE">Aktif</option><option value="INACTIVE">Pasif</option></select></div>
          <div className="flex flex-wrap gap-2"><Button><Search />Ara</Button>{result.hasFilters ? <Button asChild variant="outline"><Link href="/dashboard/schools">Temizle</Link></Button> : null}</div>
        </FilterToolbar>
        {result.records.length ? <Table><TableHeader><TableRow><TableHead>Okul</TableHead><TableHead>Durum</TableHead><TableHead>VR</TableHead><TableHead>QR</TableHead><TableHead>Oluşturulma</TableHead><TableHead>Güncellenme</TableHead><TableHead>İşlem</TableHead></TableRow></TableHeader><TableBody>{result.records.map((school) => <TableRow key={school.id}><TableCell><UpdateSchoolForm id={school.id} name={school.name} /></TableCell><TableCell><Badge variant={school.status === SchoolStatus.ACTIVE ? "secondary" : "outline"}>{school.status === SchoolStatus.ACTIVE ? "Aktif" : "Pasif"}</Badge></TableCell><TableCell>{school._count.vrRecords}</TableCell><TableCell>{school._count.qrRegistrations}</TableCell><TableCell>{date.format(school.createdAt)}</TableCell><TableCell>{date.format(school.updatedAt)}</TableCell><TableCell><SchoolStatusButton id={school.id} status={school.status} /></TableCell></TableRow>)}</TableBody></Table> : <DataEmptyState icon={School} title={result.hasFilters ? "Filtrelerle eşleşen okul bulunamadı." : "Henüz okul eklenmedi."} description={result.hasFilters ? "Arama ölçütlerini değiştirerek yeniden deneyin." : "İlk okulunuzu soldaki formdan oluşturabilirsiniz."} />}
        <DataPagination summary={<>Toplam {result.total} · Sayfa {result.page}/{result.pageCount}</>}><Button size="sm" variant="outline" asChild={result.page > 1} disabled={result.page <= 1}>{result.page > 1 ? <Link href={href(result.page - 1)}>Önceki</Link> : <span>Önceki</span>}</Button><Button size="sm" variant="outline" asChild={result.page < result.pageCount} disabled={result.page >= result.pageCount}>{result.page < result.pageCount ? <Link href={href(result.page + 1)}>Sonraki</Link> : <span>Sonraki</span>}</Button></DataPagination>
      </Card>
    </DashboardSection>
  </DashboardPage>;
}
