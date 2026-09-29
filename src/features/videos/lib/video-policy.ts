// Client-safe video library policy shared by the upload UI, server services and tests.

export const VIDEO_BUCKET = "videos";

/**
 * Upper bound for a single upload. Large 4K/360° VR files are expected, so this is deliberately high.
 * Keep in sync with the `videos` bucket `file_size_limit` (migration 20260930090000_add_video_library);
 * the Supabase project-wide upload limit must be at least this value.
 */
export const VIDEO_MAX_UPLOAD_BYTES = 20 * 1024 ** 3;

/** Supabase resumable (TUS) uploads require every chunk except the last to be exactly 6 MB. */
export const VIDEO_UPLOAD_CHUNK_BYTES = 6 * 1024 * 1024;

export const VIDEO_FORMATS = [
  { extension: "mp4", mimeType: "video/mp4" },
  { extension: "m4v", mimeType: "video/x-m4v" },
  { extension: "mov", mimeType: "video/quicktime" },
] as const;

export type VideoFormat = (typeof VIDEO_FORMATS)[number];

export const VIDEO_ACCEPT_ATTRIBUTE = VIDEO_FORMATS.flatMap((format) => [`.${format.extension}`, format.mimeType]).join(",");
