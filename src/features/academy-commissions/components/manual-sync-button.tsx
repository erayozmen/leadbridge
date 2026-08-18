"use client";
import { RefreshCw } from "lucide-react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { runAcademyManualSyncAction } from "@/features/academy-commissions/actions/manual-sync-action";
export function ManualSyncButton() {
  const [state, action, pending] = useActionState(runAcademyManualSyncAction, { status: "idle" as const, message: null });
  return <form action={action} className="flex flex-col items-end gap-2"><Button disabled={pending} size="sm"><RefreshCw className={pending ? "animate-spin" : ""}/>{pending ? "Senkronize ediliyor..." : "Şimdi Senkronize Et"}</Button>{state.message ? <p role={state.status === "error" ? "alert" : "status"} className={state.status === "error" ? "text-xs text-destructive" : "text-xs text-emerald-700"}>{state.message}</p> : null}</form>;
}
