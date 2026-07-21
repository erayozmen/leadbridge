import { Card } from "@/components/ui/card";
import { requireStaffOrAdmin } from "@/features/auth/server/auth";
import { VrRecordList } from "@/features/vr-records/components/vr-record-list";
import { listVrRecordFilterOptions, listVrRecords } from "@/features/vr-records/queries/list-vr-records";
import { requireSelectedEvent } from "@/features/events/server/event-context";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const firstValue = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

export default async function VrRecordsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireStaffOrAdmin();
  const event = await requireSelectedEvent();
  const params = await searchParams;
  const filters = {
    firstName: firstValue(params.firstName), lastName: firstValue(params.lastName), schoolId: firstValue(params.schoolId),
    createdFrom: firstValue(params.createdFrom), createdTo: firstValue(params.createdTo), createdByUserId: firstValue(params.createdByUserId),
    qrStatus: firstValue(params.qrStatus), matchStatus: firstValue(params.matchStatus),
    sort: firstValue(params.sort), pageSize: Number(firstValue(params.pageSize)),
  };
  const [result, options] = await Promise.all([
    listVrRecords({ ...filters, eventId: event.id, page: Number(firstValue(params.page)) }),
    listVrRecordFilterOptions(),
  ]);
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold">VR İzleyenler</h1>
      <p className="mt-2 text-muted-foreground">VR deneyimine katılan öğrencileri arayın, filtreleyin ve kayıt ilişkilerini yönetin.</p>
      <Card className="mt-8 gap-0 overflow-hidden rounded-lg py-0 shadow-none">
        <div className="px-5 py-5"><h2 className="font-semibold">VR kayıtları</h2><p className="mt-1 text-sm text-muted-foreground">En yeni kayıtlar önce gösterilir.</p></div>
        <VrRecordList {...result} filters={filters} options={options} role={user.role} />
      </Card>
    </main>
  );
}
