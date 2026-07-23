import { Card } from "@/components/ui/card";
import { requireStaffOrAdmin } from "@/features/auth/server/auth";
import { VrRecordList } from "@/features/vr-records/components/vr-record-list";
import { listVrRecordFilterOptions, listVrRecords } from "@/features/vr-records/queries/list-vr-records";
import { requireSelectedEvent } from "@/features/events/server/event-context";
import { EventFilter } from "@/features/events/components/event-filter";
import { listEventFilterOptions, resolveEventFilter } from "@/features/events/server/event-filter";
import { prisma } from "@/lib/prisma";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const firstValue = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

export default async function VrRecordsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireStaffOrAdmin();
  const params = await searchParams;
  const requestedEventId = firstValue(params.eventId);
  const [event, filterEvents] = user.role === "ADMIN"
    ? await Promise.all([resolveEventFilter(requestedEventId), listEventFilterOptions()])
    : [await requireSelectedEvent(), []];
  const filters = {
    eventId: event.id,
    firstName: firstValue(params.firstName), lastName: firstValue(params.lastName), schoolId: firstValue(params.schoolId),
    createdFrom: firstValue(params.createdFrom), createdTo: firstValue(params.createdTo), createdByUserId: firstValue(params.createdByUserId),
    qrStatus: firstValue(params.qrStatus), matchStatus: firstValue(params.matchStatus),
    sort: firstValue(params.sort), pageSize: Number(firstValue(params.pageSize)),
  };
  const [result, options, events] = await Promise.all([
    listVrRecords({ ...filters, page: Number(firstValue(params.page)) }),
    listVrRecordFilterOptions(),
    user.role === "ADMIN" ? prisma.event.findMany({ where: { status: { in: ["DRAFT", "ACTIVE"] } }, select: { id: true, name: true }, orderBy: { eventDate: "desc" } }) : Promise.resolve([]),
  ]);
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold">VR İzleyenler</h1>
      <p className="mt-2 text-muted-foreground">VR deneyimine katılan öğrencileri arayın, filtreleyin ve kayıt ilişkilerini yönetin.</p>
      {user.role === "ADMIN" ? <div className="mt-6"><EventFilter events={filterEvents} selectedId={event.id} /></div> : null}
      <Card className="mt-8 gap-0 overflow-hidden rounded-lg py-0 shadow-none">
        <div className="px-5 py-5"><h2 className="font-semibold">VR kayıtları</h2><p className="mt-1 text-sm text-muted-foreground">En yeni kayıtlar önce gösterilir.</p></div>
        <VrRecordList {...result} filters={filters} options={options} role={user.role} events={events} />
      </Card>
    </main>
  );
}
