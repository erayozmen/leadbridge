"use client";

import { UserRole } from "@prisma/client";
import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createUserAction, type UserAccessActionState } from "@/features/users/actions/user-actions";

const initial: UserAccessActionState = { status: "idle", message: null };

export function CreateUserForm() {
  const [state, action, pending] = useActionState(createUserAction, initial);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.status === "success") form.current?.reset(); }, [state.status]);
  return <form ref={form} action={action} className="grid gap-4 sm:grid-cols-2">
    <div className="grid gap-2"><Label htmlFor="new-full-name">Ad soyad</Label><Input id="new-full-name" name="fullName" minLength={2} maxLength={120} required disabled={pending} /></div>
    <div className="grid gap-2"><Label htmlFor="new-email">Email</Label><Input id="new-email" name="email" type="email" autoComplete="off" required disabled={pending} /></div>
    <div className="grid gap-2"><Label htmlFor="new-role">Rol</Label><select id="new-role" name="role" defaultValue={UserRole.STAFF} className="h-9 rounded-md border bg-background px-3 text-sm" disabled={pending}>{Object.values(UserRole).map((role) => <option key={role} value={role}>{role}</option>)}</select></div>
    <div className="grid gap-2"><Label htmlFor="temporary-password">Geçici şifre</Label><Input id="temporary-password" name="temporaryPassword" type="password" minLength={12} maxLength={128} autoComplete="new-password" required disabled={pending} /><p className="text-xs text-muted-foreground">Şifre yalnız hesabı oluşturmak için kullanılır; daha sonra gösterilmez veya kaydedilmez.</p></div>
    <div className="sm:col-span-2"><Button disabled={pending}>{pending ? "Oluşturuluyor..." : "Yeni Kullanıcı Oluştur"}</Button></div>
    {state.message ? <p role="status" className={state.status === "error" ? "text-sm text-destructive sm:col-span-2" : "text-sm text-emerald-700 sm:col-span-2"}>{state.message}</p> : null}
  </form>;
}
