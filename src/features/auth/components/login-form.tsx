"use client";

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
        <Label htmlFor="email">E-posta</Label>
        <Input id="email" name="email" type="email" autoComplete="email" placeholder="ad@kurum.com" required disabled={pending} className="h-11" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">Şifre</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required maxLength={256} disabled={pending} className="h-11" />
      </div>
      {state.error ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{state.error}</p>
      ) : null}
      <Button type="submit" className="h-11 w-full" disabled={pending}>
        {pending ? "Giriş yapılıyor..." : "Giriş Yap"}
      </Button>
    </form>
  );
}
