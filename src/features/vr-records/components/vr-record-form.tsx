"use client";

import { useActionState, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createVrRecordAction,
  type VrRecordActionState,
} from "@/features/vr-records/actions/vr-record-actions";

const initialState: VrRecordActionState = { status: "idle", message: null };

function FieldError({ errors }: { errors?: string[] }) {
  return errors?.[0] ? <p className="text-xs text-destructive">{errors[0]}</p> : null;
}

export function VrRecordForm({ schools, events }: { schools: Array<{ id: string; name: string }>; events: Array<{ id: string; name: string }> }) {
  const [state, action, pending] = useActionState(createVrRecordAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state.status]);

  return (
    <form ref={formRef} action={action} className="grid gap-5">
      <div className="grid gap-2">
        <Label htmlFor="eventId">Etkinlik</Label>
        <select id="eventId" name="eventId" className="h-11 rounded-md border bg-background px-3 text-sm" disabled={pending}>
          <option value="">Aktif etkinliği kullan</option>
          {events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
        </select>
        <FieldError errors={state.fieldErrors?.eventId} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="firstName">Ad</Label>
        <Input id="firstName" name="firstName" autoComplete="given-name" maxLength={80} required disabled={pending} aria-invalid={Boolean(state.fieldErrors?.firstName)} />
        <FieldError errors={state.fieldErrors?.firstName} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="lastName">Soyad</Label>
        <Input id="lastName" name="lastName" autoComplete="family-name" maxLength={80} required disabled={pending} aria-invalid={Boolean(state.fieldErrors?.lastName)} />
        <FieldError errors={state.fieldErrors?.lastName} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="schoolId">Okul</Label>
        <select id="schoolId" name="schoolId" required disabled={pending} aria-invalid={Boolean(state.fieldErrors?.schoolId)} className="h-11 rounded-md border bg-background px-3 text-sm"><option value="">Okul seçin</option>{schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select>
        <FieldError errors={state.fieldErrors?.schoolId} />
      </div>
      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="phone">Telefon</Label>
          <span className="text-xs text-muted-foreground">Opsiyonel</span>
        </div>
        <Input id="phone" name="phone" type="tel" autoComplete="tel" maxLength={30} disabled={pending} aria-invalid={Boolean(state.fieldErrors?.phone)} />
        <FieldError errors={state.fieldErrors?.phone} />
      </div>
      {state.message ? (
        <p className={state.status === "success" ? "rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800" : "rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"} role="status">
          {state.message}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Kaydediliyor..." : "VR Kaydı Oluştur"}
      </Button>
    </form>
  );
}
