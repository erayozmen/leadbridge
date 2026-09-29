"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { archiveVideoAction, type VideoActionState } from "@/features/videos/actions/video-actions";

const initial: VideoActionState = { status: "idle", message: null };

/** Two-step confirmation, matching the dashboard's existing destructive-action pattern. */
export function ArchiveVideoButton({ videoId }: { videoId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(archiveVideoAction, initial);

  if (!open) {
    return (
      <div className="grid gap-1">
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>Arşivle</Button>
        {state.status === "error" ? <p role="status" className="text-xs text-destructive">{state.message}</p> : null}
      </div>
    );
  }

  return (
    <form action={action} className="grid min-w-72 gap-3 rounded-md border border-destructive/25 bg-destructive/5 p-4 shadow-xs">
      <input type="hidden" name="videoId" value={videoId} />
      <p className="text-sm whitespace-normal">Video kütüphaneden kaldırılacak ve yeni gönderimlerde seçilemeyecek. Dosya silinmez; işlem denetim kayıtlarında saklanır.</p>
      <div className="flex gap-2">
        <Button variant="destructive" size="sm" disabled={pending}>{pending ? "Arşivleniyor..." : "Kesin Arşivle"}</Button>
        <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => setOpen(false)}>Vazgeç</Button>
      </div>
      {state.status === "error" ? <p role="status" className="text-xs text-destructive">{state.message}</p> : null}
    </form>
  );
}
