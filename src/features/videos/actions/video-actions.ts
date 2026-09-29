"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";

import { requireAdmin } from "@/features/auth/server/auth";
import { VideoError } from "@/features/videos/services/video-errors";
import {
  archiveVideo,
  completeVideoUpload,
  createVideoUpload,
  failVideoUpload,
  type VideoUploadSession,
} from "@/features/videos/services/video-service";
import { guardMutation } from "@/lib/security/request-guard";

const VIDEOS_PATH = "/dashboard/videos";
const MUTATION_LIMIT = { limit: 30, windowMs: 60_000 };

type ActionError = { ok: false; message: string };
export type CreateVideoUploadResult = { ok: true; session: VideoUploadSession } | ActionError;
export type CompleteVideoUploadActionResult = { ok: true; status: "READY" } | ActionError;
export type VideoActionState = { status: "idle" | "success" | "error"; message: string | null };

const failure = (message: string): ActionError => ({ ok: false, message });

async function authorize(scope: string): Promise<ActionError | null> {
  try {
    await requireAdmin();
  } catch {
    return failure("Bu işlem yalnızca yöneticiler tarafından yapılabilir.");
  }
  if (!await guardMutation(scope, MUTATION_LIMIT)) {
    return failure("Çok fazla işlem yapıldı. Lütfen kısa süre sonra tekrar deneyin.");
  }
  return null;
}

function message(error: unknown, fallback: string): string {
  if (error instanceof ZodError) return "Dosya bilgileri geçersiz veya dosya izin verilen boyutu aşıyor.";
  if (error instanceof VideoError) {
    switch (error.code) {
      case "UNSUPPORTED_FORMAT":
        return "Yalnızca MP4, M4V veya MOV video dosyaları yüklenebilir.";
      case "VIDEO_NOT_FOUND":
        return "Video bulunamadı. Sayfayı yenileyip tekrar deneyin.";
      case "VIDEO_STATE_CONFLICT":
        return "Videonun durumu değişmiş. Sayfayı yenileyip tekrar deneyin.";
      case "STORAGE_UNAVAILABLE":
        return "Video deposuna şu anda ulaşılamıyor. Lütfen tekrar deneyin.";
    }
  }
  return fallback;
}

/** Prepares a signed resumable upload. The returned token is for this browser session only. */
export async function createVideoUploadAction(input: {
  filename: string;
  sizeBytes: number;
}): Promise<CreateVideoUploadResult> {
  const denied = await authorize("video-upload-create");
  if (denied) return denied;
  try {
    return { ok: true, session: await createVideoUpload(input) };
  } catch (error) {
    return failure(message(error, "Yükleme başlatılamadı. Lütfen tekrar deneyin."));
  }
}

export async function completeVideoUploadAction(input: {
  videoId: string;
  sha256?: string;
}): Promise<CompleteVideoUploadActionResult> {
  const denied = await authorize("video-upload-complete");
  if (denied) return denied;
  try {
    const result = await completeVideoUpload(input);
    revalidatePath(VIDEOS_PATH);
    if (result.status === "READY") return { ok: true, status: "READY" };
    return failure(
      result.reason === "INVALID_CONTENT"
        ? "Dosya geçerli bir MP4/MOV video değil; yükleme reddedildi."
        : "Yüklenen dosya doğrulanamadı. Lütfen tekrar yükleyin.",
    );
  } catch (error) {
    return failure(message(error, "Yükleme tamamlanamadı. Lütfen tekrar deneyin."));
  }
}

export async function failVideoUploadAction(input: {
  videoId: string;
  reason: "CANCELLED" | "UPLOAD_ERROR";
}): Promise<{ ok: true } | ActionError> {
  const denied = await authorize("video-upload-fail");
  if (denied) return denied;
  try {
    await failVideoUpload(input);
    revalidatePath(VIDEOS_PATH);
    return { ok: true };
  } catch (error) {
    return failure(message(error, "Yükleme durumu güncellenemedi."));
  }
}

export async function archiveVideoAction(_state: VideoActionState, data: FormData): Promise<VideoActionState> {
  const denied = await authorize("video-archive");
  if (denied) return { status: "error", message: denied.message };
  const videoId = data.get("videoId");
  try {
    await archiveVideo({ videoId: typeof videoId === "string" ? videoId : "" });
    revalidatePath(VIDEOS_PATH);
    return { status: "success", message: "Video arşivlendi." };
  } catch (error) {
    return { status: "error", message: message(error, "Video arşivlenemedi. Lütfen tekrar deneyin.") };
  }
}
