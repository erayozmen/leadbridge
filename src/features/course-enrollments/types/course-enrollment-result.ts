export type CourseEnrollmentResult =
  | { ok: true; enrolledAt: Date }
  | { ok: false; code: "INVALID_INPUT" | "UNAUTHORIZED" | "REGISTRATION_NOT_FOUND" | "ALREADY_ENROLLED" | "ENROLLMENT_CONFLICT" | "ENROLLMENT_FAILED"; message: string };
