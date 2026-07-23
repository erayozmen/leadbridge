"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { revokeUserAccessAction, type UserAccessActionState } from "@/features/users/actions/user-actions";

const initial: UserAccessActionState = { status: "idle", message: null };

export function RevokeUserAccess({ userId, disabled }: { userId: string; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [state, action, pending] = useActionState(revokeUserAccessAction, initial);
  const valid = reason.trim().length >= 10 && reason.trim().length <= 500;
  if (!open) return <Button type="button" variant="destructive" size="sm" disabled={disabled} onClick={() => setOpen(true)}>Erişimi Kaldır</Button>;
  return <form action={action} className="grid min-w-80 gap-3 rounded-md border border-destructive/25 bg-destructive/5 p-4 shadow-xs">
    <input type="hidden" name="userId" value={userId} />
    <p className="text-sm">Kullanıcının giriş ve uygulama erişimi kalıcı olarak kaldırılacak. Geçmiş işlem kaydı audit bütünlüğü için korunur ve işlem geri alınamaz.</p>
    <Label htmlFor={`revoke-reason-${userId}`}>İşlem nedeni</Label>
    <textarea id={`revoke-reason-${userId}`} name="reason" value={reason} onChange={(event) => setReason(event.target.value)} minLength={10} maxLength={500} required disabled={pending} className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm" />
    <div className="flex gap-2"><Button variant="destructive" disabled={pending || !valid}>{pending ? "Kaldırılıyor..." : "Kesin Erişimi Kaldır"}</Button><Button type="button" variant="ghost" disabled={pending} onClick={() => { setOpen(false); setReason(""); }}>Vazgeç</Button></div>
    {state.message ? <p role="status" className={state.status === "error" ? "text-xs text-destructive" : "text-xs text-emerald-700"}>{state.message}</p> : null}
  </form>;
}
