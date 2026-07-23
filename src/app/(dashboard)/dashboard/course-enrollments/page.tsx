import { requireAdmin } from "@/features/auth/server/auth";
import { BookOpenCheck } from "lucide-react";
import { CourseEnrollmentWorkspace } from "@/features/course-enrollments/components/course-enrollment-workspace";
import {
  listCourseEnrollments,
  listCourseEnrollmentSchools,
} from "@/features/course-enrollments/queries/list-course-enrollments";
import { requireSelectedEvent } from "@/features/events/server/event-context";
import { PageHeader } from "@/components/dashboard/page-header";

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function CourseEnrollmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireAdmin();
  const event = await requireSelectedEvent();
  const params = await searchParams;
  const filters = {
    firstName: first(params.firstName),
    lastName: first(params.lastName),
    schoolId: first(params.schoolId),
    phone: first(params.phone),
    attendance: first(params.attendance),
    enrollment: first(params.enrollment),
    registeredFrom: first(params.registeredFrom),
    registeredTo: first(params.registeredTo),
    enrolledByUserId: first(params.enrolledByUserId),
    sort: first(params.sort),
    pageSize: Number(first(params.pageSize)),
  };
  const [result, schools] = await Promise.all([
    listCourseEnrollments({ ...filters, eventId: event.id, page: Number(first(params.page)) }),
    listCourseEnrollmentSchools(),
  ]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <PageHeader icon={BookOpenCheck} title="Dil Kursu Kayıtları" description="QR kaydı bulunan öğrencilerin manuel dil kursu kayıt durumunu yönetin." />
      <CourseEnrollmentWorkspace
        {...result}
        filters={filters}
        schools={schools}
        userRole={user.role}
      />
    </main>
  );
}
