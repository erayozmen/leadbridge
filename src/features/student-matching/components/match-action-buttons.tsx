"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { createStudentMatchAction, deleteStudentMatchAction, type MatchActionState } from "@/features/student-matching/actions/student-match-actions";

const initial: MatchActionState = { status: "idle", message: null };

export function CreateMatchButton({ vrRecordId, qrRegistrationId }: { vrRecordId: string; qrRegistrationId: string }) {
  const [state, action, pending] = useActionState(createStudentMatchAction, initial);
  return <div className="space-y-2"><form action={action}><input type="hidden" name="vrRecordId" value={vrRecordId} /><input type="hidden" name="qrRegistrationId" value={qrRegistrationId} /><Button disabled={pending} size="sm">{pending ? "Eşleştiriliyor..." : "Eşleştirmeyi Onayla"}</Button></form>{state.message ? <p role="status" className={state.status === "success" ? "text-sm text-emerald-700" : "text-sm text-destructive"}>{state.message}</p> : null}</div>;
}

export function DeleteMatchButton({ matchId }: { matchId: string }) {
  const [state, action, pending] = useActionState(deleteStudentMatchAction, initial);
  return <div className="space-y-3"><p className="text-sm text-muted-foreground">Bu işlem yalnızca VR ve QR kayıtları arasındaki bağlantıyı kaldırır. Kayıtlar silinmez.</p><form action={action}><input type="hidden" name="matchId" value={matchId} /><Button disabled={pending} variant="destructive">{pending ? "Kaldırılıyor..." : "Eşleşmeyi Kaldır"}</Button></form>{state.message ? <p role="status" className={state.status === "success" ? "text-sm text-emerald-700" : "text-sm text-destructive"}>{state.message}</p> : null}</div>;
}
