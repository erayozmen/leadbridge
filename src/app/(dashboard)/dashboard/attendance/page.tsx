import { Card } from "@/components/ui/card";
import { AttendanceList } from "@/features/attendance/components/attendance-list";
import { listAttendanceRegistrations } from "@/features/attendance/queries/list-attendance-registrations";
import { requireStaffOrAdmin } from "@/features/auth/server/auth";
import { requireSelectedEvent } from "@/features/events/server/event-context";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const first = (value: string | string[] | undefined) => (
  Array.isArray(value) ? value[0] : value
);

export default async function AttendancePage({ searchParams }: Props) {
  const user = await requireStaffOrAdmin();
  const event = await requireSelectedEvent();
  const params = await searchParams;
  const filters = {
    firstName: first(params.firstName),
    lastName: first(params.lastName),
    school: first(params.school),
    phone: first(params.phone),
    attendance: first(params.attendance),
    attendedByUserId: first(params.attendedByUserId),
    sort: first(params.sort),
    pageSize: Number(first(params.pageSize)),
  };
  const result = await listAttendanceRegistrations({
    ...filters,
    eventId: event.id,
    page: Number(first(params.page)),
  });

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold">Etkinlik Katılımı</h1>
      <p className="mt-2 text-muted-foreground">
        QR kaydı bulunan öğrencileri arayın ve katılım durumlarını güvenli biçimde yönetin.
      </p>
      <Card className="mt-8 gap-0 overflow-hidden rounded-lg py-0 shadow-none">
        <AttendanceList {...result} filters={filters} userRole={user.role} />
      </Card>
    </main>
  );
}
