// Client-safe helpers for validating and naming uploaded video files.
import { VIDEO_FORMATS, type VideoFormat } from "@/features/videos/lib/video-policy";

const MAX_NAME_LENGTH = 80;
const MAX_DISPLAY_NAME_LENGTH = 120;
const TURKISH_ASCII: Record<string, string> = { ı: "i", İ: "I", ğ: "g", Ğ: "G", ş: "s", Ş: "S", ç: "c", Ç: "C", ö: "o", Ö: "O", ü: "u", Ü: "U" };

/** ISO Base Media (MP4/M4V/MOV) files start with one of these top-level boxes. */
const ISO_BMFF_LEADING_BOXES = new Set(["ftyp", "moov", "mdat", "free", "skip", "wide"]);

/** The last path segment of a user-supplied name; both separators are treated as untrusted. */
function baseName(filename: string) {
  return filename.split(/[\\/]/).pop() ?? "";
}

function splitExtension(filename: string): { stem: string; extension: string } {
  const name = baseName(filename);
  const dot = name.lastIndexOf(".");
  return dot > 0 ? { stem: name.slice(0, dot), extension: name.slice(dot + 1).toLowerCase() } : { stem: name, extension: "" };
}

/** Resolves the format from the file extension only; the declared browser MIME type is not trusted. */
export function resolveVideoFormat(filename: string): VideoFormat | null {
  const { extension } = splitExtension(filename);
  return VIDEO_FORMATS.find((format) => format.extension === extension) ?? null;
}

/**
 * Builds a storage-safe object name: ASCII letters, digits, "-", "_" only, never a path separator
 * or a leading dot, so user input cannot influence the object path beyond this segment.
 */
export function sanitizeVideoFilename(filename: string, format: VideoFormat): string {
  const { stem } = splitExtension(filename);
  const ascii = stem
    .replace(/[ıİğĞşŞçÇöÖüÜ]/g, (char) => TURKISH_ASCII[char] ?? char)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "");
  const safe = ascii
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, MAX_NAME_LENGTH)
    .replace(/[-_]+$/g, "");
  return `${safe || "video"}.${format.extension}`;
}

export function displayNameFromFilename(filename: string): string {
  const { stem } = splitExtension(filename);
  return (stem.trim() || "Video").slice(0, MAX_DISPLAY_NAME_LENGTH);
}

/** Checks the container signature of the first bytes (at least 8) of a file. */
export function isIsoBaseMediaFile(head: Uint8Array): boolean {
  if (head.length < 8) return false;
  const boxType = String.fromCharCode(head[4], head[5], head[6], head[7]);
  return ISO_BMFF_LEADING_BOXES.has(boxType);
}

const byteUnits = ["B", "KB", "MB", "GB", "TB"];

export function formatBytes(bytes: number): string {
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < byteUnits.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = unit === 0 ? 0 : value < 10 ? 2 : 1;
  return `${value.toLocaleString("tr-TR", { maximumFractionDigits: digits, minimumFractionDigits: digits })} ${byteUnits[unit]}`;
}
