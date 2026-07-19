"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  unassignQrCodeAction,
  type UnassignQrCodeActionState,
} from "@/features/vr-records/actions/unassign-qr-code-action";

const initial: UnassignQrCodeActionState = { status: "idle", message: null };

export function UnassignQrCodeButton({
  vrRecordId,
  qrCodeId,
  serialNumber,
  studentName,
}: {
  vrRecordId: string;
  qrCodeId: string;
  serialNumber: string;
  studentName: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState(unassignQrCodeAction, initial);

  if (!confirming) {
    return (
      <Button type="button" size="sm" variant="outline" onClick={() => setConfirming(true)}>
        QR Atamasını Geri Al
      </Button>
    );
  }

  return (
    <div className="min-w-72 space-y-3 rounded-md border border-destructive/30 bg-destructive/5 p-3">
      <div className="space-y-1 text-xs">
        <p><strong>QR:</strong> {serialNumber}</p>
        <p><strong>VR kaydı:</strong> {studentName}</p>
        <p className="leading-5 text-muted-foreground">
          QR silinmeyecek; yalnızca bu atama kaldırılacak. Kart daha sonra başka bir öğrenciye
          atanabilir.
        </p>
      </div>
      <form action={action} className="flex flex-wrap gap-2">
        <input type="hidden" name="vrRecordId" value={vrRecordId} />
        <input type="hidden" name="qrCodeId" value={qrCodeId} />
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => setConfirming(false)}>
          Vazgeç
        </Button>
        <Button type="submit" size="sm" variant="destructive" disabled={pending}>
          {pending ? "Geri alınıyor..." : "QR Atamasını Geri Al"}
        </Button>
      </form>
      {state.message ? (
        <p role={state.status === "error" ? "alert" : "status"} className={state.status === "success" ? "text-xs text-emerald-700" : "text-xs text-destructive"}>
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
