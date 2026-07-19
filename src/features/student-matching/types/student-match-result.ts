export type CreateStudentMatchResult =
  | { ok: true; match: { id: string; matchedAt: Date } }
  | { ok: false; code: "INVALID_INPUT" | "UNAUTHORIZED" | "VR_RECORD_NOT_FOUND" | "QR_REGISTRATION_NOT_FOUND" | "VR_ALREADY_MATCHED" | "QR_REGISTRATION_ALREADY_MATCHED" | "MATCH_CONFLICT" | "MATCH_FAILED"; message: string };

export type DeleteStudentMatchResult =
  | { ok: true; message: string }
  | { ok: false; code: "INVALID_INPUT" | "UNAUTHORIZED" | "MATCH_NOT_FOUND" | "UNMATCH_CONFLICT" | "UNMATCH_FAILED"; message: string };
