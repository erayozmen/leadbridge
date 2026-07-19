export type QrAssignmentErrorCode =
  | "INVALID_INPUT"
  | "UNAUTHORIZED"
  | "VR_RECORD_NOT_FOUND"
  | "VR_ALREADY_HAS_QR"
  | "QR_NOT_FOUND"
  | "QR_NOT_AVAILABLE"
  | "ASSIGNMENT_CONFLICT"
  | "ASSIGN_FAILED";

export type QrAssignmentResult =
  | { ok: true; serialNumber: string; assignedAt: Date }
  | { ok: false; code: QrAssignmentErrorCode; message: string };
