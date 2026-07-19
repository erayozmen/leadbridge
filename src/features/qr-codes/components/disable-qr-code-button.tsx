"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { disableQrCodeAction, type DisableQrCodeActionState } from "@/features/qr-codes/actions/qr-code-actions";

const initialState: DisableQrCodeActionState = { status: "idle", message: null };

export function DisableQrCodeButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(disableQrCodeAction, initialState);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <Button type="submit" size="sm" variant="outline" disabled={pending} aria-label="QR kartını devre dışı bırak">
        {pending ? "İptal ediliyor..." : "Devre Dışı Bırak"}
      </Button>
      {state.status === "error" ? <span className="sr-only" role="alert">{state.message}</span> : null}
    </form>
  );
}
