"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { AUDIT_ACTIONS } from "@/features/audit/constants/audit-actions";
import { isAuditReasonValid } from "@/features/audit/lib/validate-audit-input";
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
  const [reason, setReason] = useState("");
  const [state, action, pending] = useActionState(unassignQrCodeAction, initial);
  const canSubmit = isAuditReasonValid(
    AUDIT_ACTIONS.QR_ASSIGNMENT_REVERSED,
    reason,
  );

  if (!confirming) {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setConfirming(true)}
      >
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
          QR silinmeyecek; yalnızca bu atama kaldırılacak. Kart daha sonra başka bir
          öğrenciye atanabilir.
        </p>
      </div>
      <form action={action} className="space-y-3">
        <input type="hidden" name="vrRecordId" value={vrRecordId} />
        <input type="hidden" name="qrCodeId" value={qrCodeId} />
        <div className="space-y-2">
          <label
            htmlFor={`unassign-qr-reason-${qrCodeId}`}
            className="text-sm font-medium"
          >
            İşlem nedeni
          </label>
          <textarea
            id={`unassign-qr-reason-${qrCodeId}`}
            name="reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            minLength={10}
            maxLength={500}
            required
            disabled={pending}
            rows={3}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
          <p className="text-xs text-muted-foreground">
            En az 10, en fazla 500 karakter.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => {
              setConfirming(false);
              setReason("");
            }}
          >
            Vazgeç
          </Button>
          <Button
            type="submit"
            size="sm"
            variant="destructive"
            disabled={pending || !canSubmit}
          >
            {pending ? "Geri alınıyor..." : "QR Atamasını Geri Al"}
          </Button>
        </div>
      </form>
      {state.message ? (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={state.status === "success"
            ? "text-xs text-emerald-700"
            : "text-xs text-destructive"}
        >
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
