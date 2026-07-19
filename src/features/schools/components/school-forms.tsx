"use client";
import { useActionState } from "react";
import type { SchoolStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSchoolAction, setSchoolStatusAction, updateSchoolAction, type SchoolActionState } from "@/features/schools/actions/school-actions";

const initial: SchoolActionState = { status: "idle", message: null };
export function CreateSchoolForm() { const [state, action, pending] = useActionState(createSchoolAction, initial); return <form action={action} className="grid gap-3"><Label htmlFor="new-school">Okul Adı</Label><Input id="new-school" name="name" minLength={2} maxLength={160} required disabled={pending} />{state.message ? <p role="status" className={state.status === "error" ? "text-sm text-destructive" : "text-sm text-emerald-700"}>{state.fieldError ?? state.message}</p> : null}<Button disabled={pending}>{pending ? "Ekleniyor..." : "Okul Ekle"}</Button></form>; }
export function UpdateSchoolForm({ id, name }: { id: string; name: string }) { const [state, action, pending] = useActionState(updateSchoolAction, initial); return <form action={action} className="flex min-w-64 gap-2"><input type="hidden" name="id" value={id} /><Input aria-label="Okul adı" name="name" defaultValue={name} minLength={2} maxLength={160} required disabled={pending} /><Button size="sm" variant="outline" disabled={pending}>Kaydet</Button>{state.status === "error" ? <span className="sr-only" role="alert">{state.message}</span> : null}</form>; }
export function SchoolStatusButton({ id, status }: { id: string; status: SchoolStatus }) { const [state, action, pending] = useActionState(setSchoolStatusAction, initial); const next = status === "ACTIVE" ? "INACTIVE" : "ACTIVE"; return <form action={action}><input type="hidden" name="id" value={id} /><input type="hidden" name="status" value={next} /><Button size="sm" variant="outline" disabled={pending}>{pending ? "Güncelleniyor..." : next === "ACTIVE" ? "Aktifleştir" : "Pasifleştir"}</Button>{state.status === "error" ? <span className="sr-only" role="alert">{state.message}</span> : null}</form>; }
