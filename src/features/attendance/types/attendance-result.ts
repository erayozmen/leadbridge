export type AttendanceResult =
  | { ok: true; attendedAt: Date }
  | { ok: false; code: "INVALID_INPUT" | "UNAUTHORIZED" | "REGISTRATION_NOT_FOUND" | "ALREADY_ATTENDED" | "ATTENDANCE_CONFLICT" | "ATTENDANCE_FAILED"; message: string };

export type ReverseAttendanceResult =
  | { ok: true }
  | {
      ok: false;
      code:
        | "INVALID_INPUT"
        | "UNAUTHORIZED"
        | "REGISTRATION_NOT_FOUND"
        | "NOT_ATTENDED"
        | "ATTENDANCE_STATE_INVALID"
        | "ATTENDANCE_REVERSAL_CONFLICT"
        | "ATTENDANCE_REVERSAL_FAILED";
      message: string;
    };
