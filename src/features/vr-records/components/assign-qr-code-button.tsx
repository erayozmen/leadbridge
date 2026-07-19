"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { assignQrCodeAction, type AssignQrCodeActionState } from "@/features/vr-records/actions/assign-qr-code-action";

const initialState: AssignQrCodeActionState = { status: "idle", message: null };

export function AssignQrCodeButton({
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
  const [state, action, pending] = useActionState(assignQrCodeAction, initialState);
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{serialNumber}</span> numaralı QR kartı {studentName} kaydına atanacak.
      </p>
      <form action={action}>
        <input type="hidden" name="vrRecordId" value={vrRecordId} />
        <input type="hidden" name="qrCodeId" value={qrCodeId} />
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Atanıyor..." : "Atamayı Onayla"}
        </Button>
      </form>
      {state.message ? (
        <p role="status" className={state.status === "success" ? "text-sm text-emerald-700" : "text-sm text-destructive"}>
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
