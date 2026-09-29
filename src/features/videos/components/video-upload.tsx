"use client";

import { CheckCircle2, Plus, TriangleAlert, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  completeVideoUploadAction,
  createVideoUploadAction,
  failVideoUploadAction,
} from "@/features/videos/actions/video-actions";
import { formatBytes, isIsoBaseMediaFile, resolveVideoFormat } from "@/features/videos/lib/video-file";
import { VIDEO_ACCEPT_ATTRIBUTE, VIDEO_MAX_UPLOAD_BYTES } from "@/features/videos/lib/video-policy";
import { UploadAbortedError, uploadResumable } from "@/features/videos/lib/resumable-upload";

type UploadState =
  | { phase: "idle" }
  | { phase: "preparing"; fileName: string }
  | { phase: "uploading"; fileName: string; uploaded: number; total: number }
  | { phase: "verifying"; fileName: string }
  | { phase: "done"; fileName: string }
  | { phase: "error"; fileName?: string; message: string };

/** Validates the file locally (extension, size, container signature) before any server call. */
async function validateFile(file: File): Promise<string | null> {
  if (!resolveVideoFormat(file.name)) return "Yalnızca MP4, M4V veya MOV video dosyaları yüklenebilir.";
  if (file.size <= 0) return "Dosya boş.";
  if (file.size > VIDEO_MAX_UPLOAD_BYTES) return `Dosya en fazla ${formatBytes(VIDEO_MAX_UPLOAD_BYTES)} olabilir.`;
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (!isIsoBaseMediaFile(head)) return "Dosya geçerli bir MP4/MOV video değil.";
  return null;
}

export function VideoUpload() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  const [state, setState] = useState<UploadState>({ phase: "idle" });
  const busy = state.phase === "preparing" || state.phase === "uploading" || state.phase === "verifying";

  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  async function start(file: File) {
    const invalid = await validateFile(file);
    if (invalid) return setState({ phase: "error", fileName: file.name, message: invalid });

    setState({ phase: "preparing", fileName: file.name });
    const created = await createVideoUploadAction({ filename: file.name, sizeBytes: file.size });
    if (!created.ok) return setState({ phase: "error", fileName: file.name, message: created.message });

    const { videoId, upload } = created.session;
    controller.current = new AbortController();
    let sha256: string;
    try {
      ({ sha256 } = await uploadResumable(file, upload, {
        signal: controller.current.signal,
        onProgress: (uploaded, total) => setState({ phase: "uploading", fileName: file.name, uploaded, total }),
      }));
    } catch (error) {
      const cancelled = error instanceof UploadAbortedError;
      await failVideoUploadAction({ videoId, reason: cancelled ? "CANCELLED" : "UPLOAD_ERROR" });
      router.refresh();
      return setState(cancelled
        ? { phase: "idle" }
        : { phase: "error", fileName: file.name, message: "Yükleme başarısız oldu. Bağlantınızı kontrol edip tekrar deneyin." });
    } finally {
      controller.current = null;
    }

    setState({ phase: "verifying", fileName: file.name });
    const completed = await completeVideoUploadAction({ videoId, sha256 });
    router.refresh();
    setState(completed.ok
      ? { phase: "done", fileName: file.name }
      : { phase: "error", fileName: file.name, message: completed.message });
  }

  const percent = state.phase === "uploading" && state.total > 0 ? Math.floor((state.uploaded / state.total) * 100) : 0;

  return (
    <div className="grid gap-3">
      <input
        ref={input}
        type="file"
        accept={VIDEO_ACCEPT_ATTRIBUTE}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void start(file);
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" disabled={busy} onClick={() => input.current?.click()}>
          <Plus />
          Video Yükle
        </Button>
        {state.phase === "uploading" ? (
          <Button type="button" variant="outline" onClick={() => controller.current?.abort()}>
            <X />
            İptal
          </Button>
        ) : null}
      </div>

      {state.phase !== "idle" ? (
        <div role="status" aria-live="polite" className="grid gap-2 rounded-lg border bg-muted/15 p-4 text-sm">
          {state.fileName ? <p className="truncate font-medium">{state.fileName}</p> : null}
          {state.phase === "preparing" ? <p className="flex items-center gap-2 text-muted-foreground"><Upload className="size-4" />Yükleme hazırlanıyor…</p> : null}
          {state.phase === "uploading" ? (
            <>
              <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
                <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${percent}%` }} />
              </div>
              <p className="text-muted-foreground">Yükleniyor… %{percent} · {formatBytes(state.uploaded)} / {formatBytes(state.total)}</p>
            </>
          ) : null}
          {state.phase === "verifying" ? <p className="text-muted-foreground">Dosya doğrulanıyor…</p> : null}
          {state.phase === "done" ? <p className="flex items-center gap-2 text-emerald-700"><CheckCircle2 className="size-4" />Tamamlandı. Video kütüphanede hazır.</p> : null}
          {state.phase === "error" ? <p className="flex items-center gap-2 text-destructive"><TriangleAlert className="size-4" />{state.message}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
