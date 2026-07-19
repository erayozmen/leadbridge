export type AttendanceResult =
  | { ok: true; attendedAt: Date }
  | { ok: false; code: "INVALID_INPUT" | "UNAUTHORIZED" | "REGISTRATION_NOT_FOUND" | "ALREADY_ATTENDED" | "ATTENDANCE_CONFLICT" | "ATTENDANCE_FAILED"; message: string };
