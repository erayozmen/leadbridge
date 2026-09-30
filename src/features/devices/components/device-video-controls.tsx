"use client";

import { Play, Square } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  sendPlayVideoAction,
  sendStopAction,
  type DevicePairingActionState,
} from "@/features/devices/actions/device-actions";

const initial: DevicePairingActionState = { status: "idle", message: null };

function ActionMessage({ state }: { state: DevicePairingActionState }) {
  if (!state.message) return null;
  return <p role="status" className={state.status === "error" ? "text-xs text-destructive whitespace-normal" : "text-xs text-emerald-700 whitespace-normal"}>{state.message}</p>;
}

/** "Video Seç" → READY library videos → "Gönder ve Oynat", plus a stop button, for one headset. */
export function DeviceVideoControls({
  deviceId,
  deviceName,
  videos,
}: {
  deviceId: string;
  deviceName: string;
  videos: ReadonlyArray<{ id: string; displayName: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [playState, playAction, playing] = useActionState(async (state: DevicePairingActionState, data: FormData) => {
    const result = await sendPlayVideoAction(state, data);
    if (result.status === "success") setOpen(false);
    return result;
  }, initial);
  const [stopState, stopAction, stopping] = useActionState(sendStopAction, initial);
  const busy = playing || stopping;

  if (!open) {
    return (
      <div className="grid min-w-40 gap-2">
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={() => setOpen(true)} disabled={busy}><Play />Video Seç</Button>
          <form action={stopAction}>
            <input type="hidden" name="deviceId" value={deviceId} />
            <Button size="sm" variant="outline" disabled={busy}><Square />{stopping ? "Gönderiliyor..." : "Durdur"}</Button>
          </form>
        </div>
        <ActionMessage state={stopping || stopState.message ? stopState : playState} />
      </div>
    );
  }

  return (
    <form action={playAction} className="grid min-w-72 gap-3 rounded-md border bg-muted/20 p-4 shadow-xs">
      <input type="hidden" name="deviceId" value={deviceId} />
      <fieldset className="grid gap-2" disabled={playing}>
        <legend className="mb-1 text-sm font-medium whitespace-normal">{deviceName} için video seç</legend>
        {videos.length ? (
          <div className="grid max-h-56 gap-1 overflow-y-auto">
            {videos.map((video) => (
              <label key={video.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm whitespace-normal hover:bg-muted">
                <input type="radio" name="videoId" value={video.id} required className="accent-primary" />
                {video.displayName}
              </label>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground whitespace-normal">Kütüphanede gönderilebilir (hazır) video yok.</p>
        )}
      </fieldset>
      <div className="flex gap-2">
        <Button size="sm" disabled={playing || !videos.length}><Play />{playing ? "Gönderiliyor..." : "Gönder ve Oynat"}</Button>
        <Button type="button" size="sm" variant="outline" disabled={playing} onClick={() => setOpen(false)}>Vazgeç</Button>
      </div>
      <ActionMessage state={playState} />
    </form>
  );
}

/** Refreshes server-rendered device state while a command is in flight. */
export function DeviceStatusAutoRefresh({ active, intervalMs = 5_000 }: { active: boolean; intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(timer);
  }, [active, intervalMs, router]);
  return null;
}
