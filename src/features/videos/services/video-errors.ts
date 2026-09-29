export type VideoErrorCode =
  | "UNSUPPORTED_FORMAT"
  | "VIDEO_NOT_FOUND"
  | "VIDEO_STATE_CONFLICT"
  | "STORAGE_UNAVAILABLE";

export class VideoError extends Error {
  constructor(readonly code: VideoErrorCode) {
    super(code);
    this.name = "VideoError";
  }
}

/** Why an upload ended in FAILED; stored in the audit log, never user-supplied free text. */
export type VideoFailureReason =
  | "CANCELLED"
  | "UPLOAD_ERROR"
  | "OBJECT_MISSING"
  | "SIZE_MISMATCH"
  | "INVALID_CONTENT";
