"use client";

import { CheckCircle2 } from "lucide-react";
import { useActionState } from "react";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { publicQrRegistrationAction, type PublicQrRegistrationState } from "@/features/qr-registration/actions/public-qr-registration-action";

const initialState: PublicQrRegistrationState = { status: "idle", message: null };
type RegistrationField = { name: "firstName" | "lastName" | "guardianName" | "phone"; label: string; autoComplete?: string; type?: ComponentProps<"input">["type"]; inputMode?: ComponentProps<"input">["inputMode"] };
const fields: RegistrationField[] = [
  { name: "firstName", label: "Ad", autoComplete: "given-name" }, { name: "lastName", label: "Soyad", autoComplete: "family-name" },
  { name: "guardianName", label: "Veli Adı Soyadı", autoComplete: "name" }, { name: "phone", label: "Telefon Numarası", autoComplete: "tel", type: "tel", inputMode: "tel" },
];
function FieldError({ errors }: { errors?: string[] }) { return errors?.[0] ? <p className="text-xs text-destructive">{errors[0]}</p> : null; }

export function QrRegistrationForm({ token, schools }: { token: string; schools: Array<{ id: string; name: string }> }) {
  const [state, action, pending] = useActionState(publicQrRegistrationAction, initialState);
  if (state.status === "success") return <div className="py-8 text-center" role="status"><span className="mx-auto grid size-12 place-items-center rounded-full bg-emerald-50 text-emerald-700"><CheckCircle2 /></span><h2 className="mt-5 text-xl font-semibold">Kayıt tamamlandı</h2><p className="mt-2 text-sm text-muted-foreground">{state.message}</p></div>;
  return <form action={action} className="grid gap-5"><input type="hidden" name="token" value={token} />{fields.map((field) => { const errors = state.fieldErrors?.[field.name]; return <div key={field.name} className="grid gap-2"><Label htmlFor={field.name}>{field.label}</Label><Input id={field.name} name={field.name} type={field.type ?? "text"} inputMode={field.inputMode} autoComplete={field.autoComplete} required maxLength={field.name === "phone" ? 24 : 80} disabled={pending} aria-invalid={Boolean(errors)} className="h-12 text-base" /><FieldError errors={errors} /></div>; })}<div className="grid min-w-0 gap-2"><Label htmlFor="schoolId">Okul</Label><select id="schoolId" name="schoolId" required disabled={pending} aria-invalid={Boolean(state.fieldErrors?.schoolId)} className="h-12 min-w-0 max-w-full rounded-md border bg-background px-3 text-base"><option value="">Okul seçiniz</option>{schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select><FieldError errors={state.fieldErrors?.schoolId} /></div>{state.message ? <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{state.message}</p> : null}<Button type="submit" className="h-12 text-base" disabled={pending}>{pending ? "Kaydınız alınıyor..." : "Kaydı Tamamla"}</Button></form>;
}
