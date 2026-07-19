export type QrUnassignmentErrorCode =
  | "INVALID_INPUT"
  | "UNAUTHORIZED"
  | "ASSIGNMENT_NOT_FOUND"
  | "QR_ALREADY_USED"
  | "QR_HAS_REGISTRATION"
  | "QR_HAS_STUDENT_MATCH"
  | "QR_ARCHIVED"
  | "QR_DISABLED"
  | "QR_NOT_UNASSIGNABLE"
  | "UNASSIGNMENT_CONFLICT"
  | "UNASSIGNMENT_FAILED";

export type QrUnassignmentResult =
  | { ok: true; serialNumber: string }
  | { ok: false; code: QrUnassignmentErrorCode; message: string };
