import { requireAdmin } from "@/features/auth/server/auth";
import { CourseEnrollmentWorkspace } from "@/features/course-enrollments/components/course-enrollment-workspace";
import {
  listCourseEnrollments,
  listCourseEnrollmentSchools,
} from "@/features/course-enrollments/queries/list-course-enrollments";

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function CourseEnrollmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireAdmin();
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
    listCourseEnrollments({ ...filters, page: Number(first(params.page)) }),
    listCourseEnrollmentSchools(),
  ]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-semibold">Dil Kursu Kayıtları</h1>
      <p className="mt-2 text-muted-foreground">
        QR kaydı bulunan öğrencilerin manuel dil kursu kayıt durumunu yönetin.
      </p>
      <CourseEnrollmentWorkspace
        {...result}
        filters={filters}
        schools={schools}
        userRole={user.role}
      />
    </main>
  );
}
