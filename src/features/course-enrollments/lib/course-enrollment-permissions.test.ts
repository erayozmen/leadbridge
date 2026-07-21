import { UserRole } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { canReverseCourseEnrollment } from "@/features/course-enrollments/lib/course-enrollment-permissions";

describe("course enrollment reversal visibility", () => {
  it("allows only ADMIN to reverse enrolled records", () => {
    expect(canReverseCourseEnrollment(UserRole.ADMIN, true)).toBe(true);
    expect(canReverseCourseEnrollment(UserRole.STAFF, true)).toBe(false);
    expect(canReverseCourseEnrollment(UserRole.ADMIN, false)).toBe(false);
  });
});
