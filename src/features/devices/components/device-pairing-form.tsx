"use client";

import { Check, Copy } from "lucide-react";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createDevicePairingAction,
  type DevicePairingActionState,
} from "@/features/devices/actions/device-actions";
import { PAIRING_CODE_TTL_HOURS } from "@/features/devices/lib/pairing-policy";

const initial: DevicePairingActionState = { status: "idle", message: null };
const dateTime = new Intl.DateTimeFormat("tr-TR", { dateStyle: "short", timeStyle: "short" });

export function DevicePairingForm() {
  const [state, action, pending] = useActionState(createDevicePairingAction, initial);

  return (
    <div className="grid gap-4">
      <form action={action} className="grid gap-3">
        <Label htmlFor="device-name">Cihaz Adı</Label>
        <Input id="device-name" name="name" placeholder="Örn. Quest 3 #1" minLength={2} maxLength={80} required disabled={pending} />
        {state.status === "error" ? <p role="status" className="text-sm text-destructive">{state.message}</p> : null}
        <Button disabled={pending}>{pending ? "Oluşturuluyor..." : "Cihaz Eşleştir"}</Button>
      </form>
      {state.pairing ? <PairingCodeNotice key={state.pairing.pairingCode} {...state.pairing} /> : null}
    </div>
  );
}

/** Displays a freshly issued pairing code; the server never returns it again. */
export function PairingCodeNotice({ pairingCode, expiresAt }: { pairingCode: string; expiresAt: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(pairingCode);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div role="status" className="grid gap-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 text-center">
      <p className="text-sm font-medium text-emerald-800">Eşleştirme kodu</p>
      <p className="font-mono text-2xl font-semibold tracking-[0.2em] break-all select-all">{pairingCode}</p>
      <Button type="button" variant="outline" size="sm" onClick={copy} className="mx-auto">
        {copied ? <Check /> : <Copy />}
        {copied ? "Kopyalandı" : "Kodu Kopyala"}
      </Button>
      <p className="text-xs leading-5 text-muted-foreground">
        {PAIRING_CODE_TTL_HOURS} saat geçerlidir (son: {dateTime.format(new Date(expiresAt))}). Kod yalnızca bir kez gösterilir; Quest üzerindeki LeadBridge VR Agent uygulamasına girin.
      </p>
    </div>
  );
}
