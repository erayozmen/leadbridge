"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
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
        <p role="status" className={state.status === "success" ? "text-sm text-emerald-700" : "text-sm text-destructive"}>
          {state.message}
        </p>
      ) : null}
    </div>
  );
}

export function DeleteMatchButton({
  matchId,
  vrRecordId,
  vrStudentName,
  qrStudentName,
}: {
  matchId: string;
  vrRecordId: string;
  vrStudentName: string;
  qrStudentName: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState(deleteStudentMatchAction, initial);

  if (!confirming) {
    return (
      <Button type="button" variant="destructive" onClick={() => setConfirming(true)}>
        Eşleşmeyi Kaldır
      </Button>
    );
  }

  return (
    <div className="space-y-4 rounded-md border border-destructive/30 bg-destructive/5 p-4">
      <div className="space-y-2 text-sm">
        <p><strong>VR kaydı:</strong> {vrStudentName}</p>
        <p><strong>QR kaydı:</strong> {qrStudentName}</p>
        <p className="text-muted-foreground">
          Yalnızca bu iki kayıt arasındaki eşleşme kaldırılacak. Ana kayıtlar, QR ataması,
          katılım ve dil kursu bilgileri silinmeyecek veya değiştirilmeyecek. Kayıtlar daha sonra
          yeniden eşleştirilebilir.
        </p>
      </div>
      <form action={action} className="flex flex-wrap gap-2">
        <input type="hidden" name="matchId" value={matchId} />
        <input type="hidden" name="vrRecordId" value={vrRecordId} />
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => setConfirming(false)}
        >
          Vazgeç
        </Button>
        <Button type="submit" disabled={pending} variant="destructive">
          {pending ? "Kaldırılıyor..." : "Eşleşmeyi Kaldır"}
        </Button>
      </form>
      {state.message ? (
        <p role={state.status === "error" ? "alert" : "status"} className={state.status === "success" ? "text-sm text-emerald-700" : "text-sm text-destructive"}>
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
