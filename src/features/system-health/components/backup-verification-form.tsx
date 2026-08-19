"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { recordBackupVerificationAction } from "../actions/backup-verification-action";

const initial = { status: "idle" as const, message: null };
export function BackupVerificationForm() {
  const [state, action, pending] = useActionState(recordBackupVerificationAction, initial);
  return <form action={action} className="grid gap-4">
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="grid gap-2"><Label htmlFor="managedStatus">Managed backup</Label><select id="managedStatus" name="managedStatus" defaultValue="ACTIVE" className="h-10 rounded-md border bg-background px-3"><option value="ACTIVE">Aktif</option><option value="INACTIVE">Aktif değil</option><option value="UNKNOWN">Bilinmiyor</option></select></div>
      <div className="grid gap-2"><Label htmlFor="pitrStatus">PITR</Label><select id="pitrStatus" name="pitrStatus" defaultValue="DISABLED" className="h-10 rounded-md border bg-background px-3"><option value="ENABLED">Etkin</option><option value="DISABLED">Devre dışı (opsiyonel)</option><option value="UNKNOWN">Bilinmiyor</option></select></div>
    </div>
    <div className="grid gap-2"><Label htmlFor="lastBackupAt">Son managed backup zamanı</Label><Input id="lastBackupAt" name="lastBackupAt" type="datetime-local" /></div>
    <div className="grid gap-2"><Label htmlFor="restoreStatus">Restore rehearsal</Label><select id="restoreStatus" name="restoreStatus" defaultValue="NOT_RECORDED" className="h-10 rounded-md border bg-background px-3"><option value="NOT_RECORDED">Henüz kaydetme</option><option value="VERIFIED">Doğrulandı</option><option value="FAILED">Başarısız</option></select></div>
    <div className="grid gap-2"><Label htmlFor="manifest">Logical backup manifest JSON (opsiyonel)</Label><textarea id="manifest" name="manifest" rows={5} maxLength={4000} className="min-w-0 rounded-md border bg-background p-3 font-mono text-xs" placeholder="backup scriptinin ürettiği .manifest.json içeriği" /></div>
    {state.message ? <p role="status" className={state.status === "success" ? "text-sm text-emerald-700" : "text-sm text-destructive"}>{state.message}</p> : null}
    <Button disabled={pending}>{pending ? "Kaydediliyor…" : "Backup Durumunu Doğrula"}</Button>
  </form>;
}
