"use client";

import { Archive } from "lucide-react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  archiveAllDisabledQrCodesAction,
  archiveQrCodeAction,
  type ArchiveQrCodeActionState,
} from "@/features/qr-codes/actions/qr-code-actions";

const initialState: ArchiveQrCodeActionState = { status: "idle", message: null };

export function ArchiveQrCodeButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(archiveQrCodeAction, initialState);
  return (
    <form action={action} className="grid gap-1">
      <input type="hidden" name="id" value={id} />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        <Archive aria-hidden="true" />{pending ? "Arşivleniyor..." : "Arşivle"}
      </Button>
      {state.message ? <span className="sr-only" role={state.status === "error" ? "alert" : "status"}>{state.message}</span> : null}
    </form>
  );
}

export function ArchiveAllDisabledQrCodesButton() {
  const [state, action, pending] = useActionState(archiveAllDisabledQrCodesAction, initialState);
  return (
    <form action={action} className="grid gap-2 sm:justify-items-end">
      <p className="max-w-md text-xs text-muted-foreground">İlişkisiz ve devre dışı QR kartları ana listeden kaldırılacak. Seri numarası geçmişi korunacaktır.</p>
      <Button type="submit" variant="outline" disabled={pending}>
        <Archive aria-hidden="true" />{pending ? "Arşivleniyor..." : "Devre Dışı Olanları Listeden Kaldır"}
      </Button>
      {state.message ? <p role={state.status === "error" ? "alert" : "status"} className={state.status === "error" ? "text-xs text-destructive" : "text-xs text-emerald-700"}>{state.message}</p> : null}
    </form>
  );
}
