"use client";

import { UserRole, UserStatus } from "@prisma/client";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateUserAccessAction, type UserAccessActionState } from "@/features/users/actions/user-actions";

const initial: UserAccessActionState = { status: "idle", message: null };

export function UserAccessControl({ userId, role, status, isSelf }: { userId: string; role: UserRole; status: UserStatus; isSelf: boolean }) {
  const [state, action, pending] = useActionState(updateUserAccessAction, initial);
  const [kind, setKind] = useState<"role" | "status" | null>(null);
  return <div className="min-w-[30rem]"><form action={action} className="grid gap-2"><input type="hidden" name="userId" value={userId}/>{kind ? <><input type="hidden" name="kind" value={kind}/><div className="flex gap-2"><select name="value" defaultValue={kind === "role" ? role : status} className="h-9 rounded-md border bg-background px-2 text-sm">{kind === "role" ? Object.values(UserRole).map(item=><option key={item}>{item}</option>) : Object.values(UserStatus).map(item=><option key={item}>{item}</option>)}</select><Input name="reason" placeholder="İşlem nedeni (10-500 karakter)" minLength={10} maxLength={500} required disabled={pending}/><Button disabled={pending || isSelf && kind === "status"}>Kesin onay</Button><Button type="button" variant="ghost" onClick={()=>setKind(null)} disabled={pending}>Vazgeç</Button></div></> : <div className="flex gap-2"><Button type="button" variant="outline" onClick={()=>setKind("role")}>Rol değiştir</Button><Button type="button" variant="outline" onClick={()=>setKind("status")} disabled={isSelf}>Durum değiştir</Button></div>}{state.message?<p role="status" className={state.status === "error" ? "text-xs text-destructive" : "text-xs text-emerald-700"}>{state.message}</p>:null}</form></div>;
}
