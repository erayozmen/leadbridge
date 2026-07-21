import { UserRole } from "@prisma/client";

export function canReverseCourseEnrollment(
  role: UserRole,
  enrolledCourse: boolean,
): boolean {
  return role === UserRole.ADMIN && enrolledCourse;
}
