export type CourseEnrollmentResult =
  | { ok: true; enrolledAt: Date }
  | { ok: false; code: "INVALID_INPUT" | "UNAUTHORIZED" | "REGISTRATION_NOT_FOUND" | "ALREADY_ENROLLED" | "ENROLLMENT_CONFLICT" | "ENROLLMENT_FAILED"; message: string };

export type ReverseCourseEnrollmentResult =
  | { ok: true }
  | {
      ok: false;
      code:
        | "INVALID_INPUT"
        | "UNAUTHORIZED"
        | "REGISTRATION_NOT_FOUND"
        | "NOT_ENROLLED"
        | "ENROLLMENT_STATE_INVALID"
        | "ENROLLMENT_REVERSAL_CONFLICT"
        | "ENROLLMENT_REVERSAL_FAILED";
      message: string;
    };
