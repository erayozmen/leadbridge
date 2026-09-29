// Browser-side resumable (TUS 1.0.0) upload directly to Supabase Storage using a signed upload token.
// Video bytes never pass through the application server.
import { Sha256 } from "@/features/videos/lib/sha256-stream";

export type ResumableUploadTarget = {
  /** `<supabase-url>/storage/v1/upload/resumable/sign` */
  endpoint: string;
  /** Short-lived signed upload token bound to one object path; never logged. */
  token: string;
  bucket: string;
  objectName: string;
  contentType: string;
  chunkSize: number;
};

export type ResumableUploadOptions = {
  onProgress?: (uploadedBytes: number, totalBytes: number) => void;
  signal?: AbortSignal;
  maxRetries?: number;
};

export class UploadAbortedError extends Error {
  constructor() {
    super("UPLOAD_ABORTED");
    this.name = "UploadAbortedError";
  }
}

export class UploadFailedError extends Error {
  constructor(readonly status: number) {
    super(`UPLOAD_FAILED_${status}`);
    this.name = "UploadFailedError";
  }
}

const TUS_VERSION = "1.0.0";
const RETRY_DELAYS_MS = [1_000, 3_000, 5_000, 10_000, 20_000];

function base64(value: string) {
  return btoa(String.fromCharCode(...new TextEncoder().encode(value)));
}

/** TUS `Upload-Metadata`: comma-separated `key base64(value)` pairs. */
export function encodeUploadMetadata(metadata: Record<string, string>): string {
  return Object.entries(metadata).map(([key, value]) => `${key} ${base64(value)}`).join(",");
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new UploadAbortedError());
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(timer); reject(new UploadAbortedError()); }, { once: true });
  });
}

type XhrResult = { status: number; offset: number | null; location: string | null };

function send(
  method: string,
  url: string,
  headers: Record<string, string>,
  body: Uint8Array | null,
  signal?: AbortSignal,
  onUploadProgress?: (loaded: number) => void,
): Promise<XhrResult> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new UploadAbortedError());
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value);
    if (onUploadProgress) xhr.upload.onprogress = (event) => onUploadProgress(event.loaded);
    const abort = () => xhr.abort();
    signal?.addEventListener("abort", abort, { once: true });
    xhr.onload = () => {
      signal?.removeEventListener("abort", abort);
      const offset = xhr.getResponseHeader("Upload-Offset");
      resolve({ status: xhr.status, offset: offset === null ? null : Number(offset), location: xhr.getResponseHeader("Location") });
    };
    xhr.onerror = () => { signal?.removeEventListener("abort", abort); resolve({ status: 0, offset: null, location: null }); };
    xhr.onabort = () => reject(new UploadAbortedError());
    xhr.send(body ? new Blob([body as BlobPart]) : null);
  });
}

const retryable = (status: number) => status === 0 || status === 409 || status === 423 || status === 429 || status >= 500;

/**
 * Uploads `file` in fixed-size chunks, retrying transient failures from the server-confirmed offset,
 * and returns the SHA-256 of the uploaded bytes computed from the chunks it already had to read.
 */
export async function uploadResumable(
  file: Blob,
  target: ResumableUploadTarget,
  { onProgress, signal, maxRetries = RETRY_DELAYS_MS.length }: ResumableUploadOptions = {},
): Promise<{ sha256: string }> {
  const auth = { "Tus-Resumable": TUS_VERSION, "x-signature": target.token };

  const created = await send("POST", target.endpoint, {
    ...auth,
    "Upload-Length": String(file.size),
    "Upload-Metadata": encodeUploadMetadata({
      bucketName: target.bucket,
      objectName: target.objectName,
      contentType: target.contentType,
      cacheControl: "3600",
    }),
    "x-upsert": "false",
  }, null, signal);
  if (created.status !== 201 || !created.location) throw new UploadFailedError(created.status);
  const uploadUrl = new URL(created.location, target.endpoint).toString();

  const hasher = new Sha256();
  let offset = 0;
  let failures = 0;
  onProgress?.(0, file.size);

  while (offset < file.size) {
    const chunk = new Uint8Array(await file.slice(offset, offset + target.chunkSize).arrayBuffer());
    const chunkStart = offset;
    let result = await send("PATCH", uploadUrl, {
      ...auth,
      "Upload-Offset": String(offset),
      "Content-Type": "application/offset+octet-stream",
    }, chunk, signal, (loaded) => onProgress?.(chunkStart + loaded, file.size));

    if (result.status !== 204 || result.offset === null) {
      if (!retryable(result.status) || failures >= maxRetries) throw new UploadFailedError(result.status);
      await sleep(RETRY_DELAYS_MS[Math.min(failures, RETRY_DELAYS_MS.length - 1)], signal);
      failures += 1;
      // Ask the server how much it actually stored; the lost response may have been a success.
      result = await send("HEAD", uploadUrl, auth, null, signal);
      if (result.offset === null) {
        if (!retryable(result.status)) throw new UploadFailedError(result.status);
        continue;
      }
    } else {
      failures = 0;
    }

    const confirmed = result.offset;
    if (confirmed < chunkStart || confirmed > chunkStart + chunk.length) throw new UploadFailedError(409);
    // Hash exactly the bytes the server confirmed, in order; the rest is re-read on the next pass.
    hasher.update(chunk.subarray(0, confirmed - chunkStart));
    offset = confirmed;
    onProgress?.(offset, file.size);
  }

  return { sha256: hasher.digestHex() };
}
