"use client";

import type { DeviceStatus } from "@prisma/client";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  cancelDevicePairingAction,
  disableDeviceAction,
  renewDevicePairingAction,
  type DevicePairingActionState,
} from "@/features/devices/actions/device-actions";
import { PairingCodeNotice } from "@/features/devices/components/device-pairing-form";
import { PAIRING_CODE_TTL_HOURS } from "@/features/devices/lib/pairing-policy";

type DeviceAction = (state: DevicePairingActionState, data: FormData) => Promise<DevicePairingActionState>;

const initial: DevicePairingActionState = { status: "idle", message: null };

/** Two-step confirmation, matching the dashboard's existing destructive-action pattern. */
function ConfirmDeviceAction({
  deviceId,
  action,
  label,
  description,
  confirmLabel,
  pendingLabel,
  destructive = false,
}: {
  deviceId: string;
  action: DeviceAction;
  label: string;
  description: string;
  confirmLabel: string;
  pendingLabel: string;
  destructive?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, initial);

  if (state.pairing) return <PairingCodeNotice key={state.pairing.pairingCode} {...state.pairing} />;
  if (!open) {
    return (
      <div className="grid gap-1">
        <Button type="button" size="sm" variant={destructive ? "destructive" : "outline"} onClick={() => setOpen(true)}>{label}</Button>
        {state.message ? <p role="status" className={state.status === "error" ? "text-xs text-destructive" : "text-xs text-emerald-700"}>{state.message}</p> : null}
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className={destructive
        ? "grid min-w-72 gap-3 rounded-md border border-destructive/25 bg-destructive/5 p-4 shadow-xs"
        : "grid min-w-72 gap-3 rounded-md border bg-muted/20 p-4 shadow-xs"}
    >
      <input type="hidden" name="deviceId" value={deviceId} />
      <p className="text-sm whitespace-normal">{description}</p>
      <div className="flex gap-2">
        <Button variant={destructive ? "destructive" : "default"} size="sm" disabled={pending}>{pending ? pendingLabel : confirmLabel}</Button>
        <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => setOpen(false)}>Vazgeç</Button>
      </div>
      {state.status === "error" ? <p role="status" className="text-xs text-destructive">{state.message}</p> : null}
    </form>
  );
}

export function DeviceRowActions({ deviceId, status }: { deviceId: string; status: DeviceStatus }) {
  // Stable keys keep the renew form (and a code it is showing) mounted when a DISABLED device
  // becomes PENDING after re-pairing is opened.
  return (
    <div className="flex flex-wrap items-start gap-2">
      {status !== "ACTIVE" ? (
        <ConfirmDeviceAction
          key="renew"
          deviceId={deviceId}
          action={renewDevicePairingAction}
          label={status === "DISABLED" ? "Yeniden Eşleştir" : "Kodu Yenile"}
          description={status === "DISABLED"
            ? `Cihaz yeniden eşleştirme için açılacak ve ${PAIRING_CODE_TTL_HOURS} saat geçerli yeni bir kod oluşturulacak.`
            : `Bu cihaz için ${PAIRING_CODE_TTL_HOURS} saat geçerli yeni bir kod oluşturulacak. Önceki kod hemen geçersiz olur.`}
          confirmLabel="Yeni Kod Oluştur"
          pendingLabel="Oluşturuluyor..."
        />
      ) : null}
      {status === "PENDING" ? (
        <ConfirmDeviceAction
          key="cancel"
          deviceId={deviceId}
          action={cancelDevicePairingAction}
          label="Eşleşmeyi İptal Et"
          description="Eşleşmemiş cihaz kaydı ve kodu kalıcı olarak silinecek. İşlem denetim kayıtlarında saklanır."
          confirmLabel="Kesin İptal Et"
          pendingLabel="İptal ediliyor..."
          destructive
        />
      ) : null}
      {status === "ACTIVE" ? (
        <ConfirmDeviceAction
          key="disable"
          deviceId={deviceId}
          action={disableDeviceAction}
          label="Cihazı Kaldır"
          description="Cihaz devre dışı bırakılacak ve erişim anahtarları iptal edilecek. Cihaz sunucuya bağlanamaz; gerekirse daha sonra yeniden eşleştirilebilir."
          confirmLabel="Kesin Kaldır"
          pendingLabel="Kaldırılıyor..."
          destructive
        />
      ) : null}
    </div>
  );
}
