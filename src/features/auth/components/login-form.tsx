"use client";

import { AlertCircle, ArrowRight, LockKeyhole, Mail } from "lucide-react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login, type LoginState } from "@/features/auth/actions/auth-actions";

const initialState: LoginState = { error: null };

export function LoginForm() {
  const [state, action, pending] = useActionState(login, initialState);

  return (
    <form action={action} className="grid gap-5">
      <div className="grid gap-2">
        <Label htmlFor="email" className="flex items-center gap-2"><Mail aria-hidden="true" className="size-3.5 text-muted-foreground" />E-posta</Label>
        <Input id="email" name="email" type="email" autoComplete="email" placeholder="ad@kurum.com" required disabled={pending} className="h-12 bg-white" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password" className="flex items-center gap-2"><LockKeyhole aria-hidden="true" className="size-3.5 text-muted-foreground" />Şifre</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required maxLength={256} disabled={pending} className="h-12 bg-white" />
      </div>
      {state.error ? (
        <p className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800" role="alert"><AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{state.error}</p>
      ) : null}
      <Button type="submit" className="h-12 w-full" disabled={pending}>
        {pending ? "Giriş yapılıyor..." : "Giriş Yap"} {!pending ? <ArrowRight aria-hidden="true" /> : null}
      </Button>
    </form>
  );
}
