import "server-only";

import { VIDEO_BUCKET } from "@/features/videos/lib/video-policy";
import { VideoError } from "@/features/videos/services/video-errors";
import { getSupabaseAdminEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const HEAD_BYTES = 16;
const HEAD_URL_TTL_SECONDS = 60;

function bucket() {
  return createSupabaseAdminClient().storage.from(VIDEO_BUCKET);
}

export type SignedVideoUpload = { endpoint: string; token: string };

/** Issues a signed, path-bound resumable upload token. The service role key never leaves the server. */
export async function createSignedVideoUpload(storagePath: string): Promise<SignedVideoUpload> {
  const { data, error } = await bucket().createSignedUploadUrl(storagePath, { upsert: false });
  if (error || !data?.token) throw new VideoError("STORAGE_UNAVAILABLE");
  const base = getSupabaseAdminEnv().url.replace(/\/$/, "");
  return { endpoint: `${base}/storage/v1/upload/resumable/sign`, token: data.token };
}

export type StoredVideoObject = { sizeBytes: number; contentType: string | null };

/** Metadata of the uploaded object as recorded by Storage, or null if it does not exist. */
export async function getStoredVideoObject(storagePath: string): Promise<StoredVideoObject | null> {
  const storage = bucket();
  const exists = await storage.exists(storagePath);
  if (exists.error) throw new VideoError("STORAGE_UNAVAILABLE");
  if (!exists.data) return null;
  const { data, error } = await storage.info(storagePath);
  if (error || !data) throw new VideoError("STORAGE_UNAVAILABLE");
  return { sizeBytes: Number(data.size ?? -1), contentType: data.contentType ?? null };
}

/** Reads only the first bytes of the object through a 60-second signed URL (a ranged request). */
export async function readStoredVideoHead(storagePath: string): Promise<Uint8Array> {
  const { data, error } = await bucket().createSignedUrl(storagePath, HEAD_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) throw new VideoError("STORAGE_UNAVAILABLE");
  const response = await fetch(data.signedUrl, {
    headers: { range: `bytes=0-${HEAD_BYTES - 1}` },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok || !response.body) throw new VideoError("STORAGE_UNAVAILABLE");
  // Stop after the first bytes even if the server ignored the Range header.
  const reader = response.body.getReader();
  const head = new Uint8Array(HEAD_BYTES);
  let length = 0;
  while (length < HEAD_BYTES) {
    const { value, done } = await reader.read();
    if (done || !value) break;
    const take = Math.min(value.length, HEAD_BYTES - length);
    head.set(value.subarray(0, take), length);
    length += take;
  }
  await reader.cancel().catch(() => undefined);
  return head.subarray(0, length);
}

/** Best-effort removal of an object that failed validation; the database record is kept. */
export async function removeStoredVideo(storagePath: string): Promise<void> {
  await bucket().remove([storagePath]).catch(() => undefined);
}
