"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { AUDIT_ACTIONS } from "@/features/audit/constants/audit-actions";
import { isAuditReasonValid } from "@/features/audit/lib/validate-audit-input";
import {
  createStudentMatchAction,
  deleteStudentMatchAction,
  type MatchActionState,
} from "@/features/student-matching/actions/student-match-actions";

const initial: MatchActionState = { status: "idle", message: null };

export function CreateMatchButton({
  vrRecordId,
  qrRegistrationId,
}: {
  vrRecordId: string;
  qrRegistrationId: string;
}) {
  const [state, action, pending] = useActionState(createStudentMatchAction, initial);
  return (
    <div className="space-y-2">
      <form action={action}>
        <input type="hidden" name="vrRecordId" value={vrRecordId} />
        <input type="hidden" name="qrRegistrationId" value={qrRegistrationId} />
        <Button disabled={pending} size="sm">
          {pending ? "Eşleştiriliyor..." : "Eşleştirmeyi Onayla"}
        </Button>
      </form>
      {state.message ? (
        <p
          role="status"
          className={state.status === "success"
            ? "text-sm text-emerald-700"
            : "text-sm text-destructive"}
        >
          {state.message}
        </p>
      ) : null}
    </div>
  );
}

export function DeleteMatchButton({
  matchId,
  vrRecordId,
  qrRegistrationId,
  vrStudentName,
  qrStudentName,
}: {
  matchId: string;
  vrRecordId: string;
  qrRegistrationId: string;
  vrStudentName: string;
  qrStudentName: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [state, action, pending] = useActionState(deleteStudentMatchAction, initial);
  const canSubmit = isAuditReasonValid(
    AUDIT_ACTIONS.STUDENT_MATCH_REMOVED,
    reason,
  );

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="destructive"
        onClick={() => setConfirming(true)}
      >
        Eşleşmeyi Kaldır
      </Button>
    );
  }

  return (
    <div className="space-y-4 rounded-md border border-destructive/25 bg-destructive/5 p-4 shadow-xs">
      <div className="space-y-2 text-sm">
        <p><strong>VR kaydı:</strong> {vrStudentName}</p>
        <p><strong>QR kaydı:</strong> {qrStudentName}</p>
        <p className="text-muted-foreground">
          Yalnızca bu iki kayıt arasındaki eşleşme kaldırılacak. Ana kayıtlar, QR ataması,
          katılım ve dil kursu bilgileri silinmeyecek veya değiştirilmeyecek. Kayıtlar daha
          sonra yeniden eşleştirilebilir.
        </p>
      </div>
      <form action={action} className="space-y-3">
        <input type="hidden" name="matchId" value={matchId} />
        <input type="hidden" name="vrRecordId" value={vrRecordId} />
        <input type="hidden" name="qrRegistrationId" value={qrRegistrationId} />
        <div className="space-y-2">
          <label
            htmlFor={`delete-match-reason-${matchId}`}
            className="text-sm font-medium"
          >
            İşlem nedeni
          </label>
          <textarea
            id={`delete-match-reason-${matchId}`}
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
            disabled={pending || !canSubmit}
            variant="destructive"
          >
            {pending ? "Kaldırılıyor..." : "Eşleşmeyi Kaldır"}
          </Button>
        </div>
      </form>
      {state.message ? (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={state.status === "success"
            ? "text-sm text-emerald-700"
            : "text-sm text-destructive"}
        >
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
