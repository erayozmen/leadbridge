"use client";

import { Archive, Download, ShieldCheck } from "lucide-react";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateQrCodesAction, type GenerateQrCodesActionState } from "@/features/qr-codes/actions/qr-code-actions";
import { buildQrZip, createQrZipFileName } from "@/features/qr-codes/lib/build-qr-zip";

const initialState: GenerateQrCodesActionState = { status: "idle", message: null };

export function GenerateQrCodesForm() {
  const [state, action, pending] = useActionState(generateQrCodesAction, initialState);
  const [zipPending, setZipPending] = useState(false);
  const [zipError, setZipError] = useState<string | null>(null);

  function downloadBlob(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function downloadCsv() {
    if (!state.csv || !state.fileName) return;
    downloadBlob(new Blob(["\uFEFF", state.csv], { type: "text/csv;charset=utf-8" }), state.fileName);
  }

  async function downloadZip() {
    if (!state.rows || !state.csv) return;
    setZipPending(true);
    setZipError(null);
    try {
      downloadBlob(await buildQrZip(state.rows, state.csv), createQrZipFileName());
    } catch {
      setZipError("QR görselleri hazırlanamadı. CSV çıktısını güvenli bir yerde saklayın ve tekrar deneyin.");
    } finally {
      setZipPending(false);
    }
  }

  return (
    <form action={action} className="grid gap-5">
      <div className="grid gap-2">
        <Label htmlFor="quantity">Adet</Label>
        <Input id="quantity" name="quantity" type="number" min={1} max={500} step={1} defaultValue={50} required disabled={pending} aria-invalid={Boolean(state.fieldError)} />
        {state.fieldError ? <p className="text-xs text-destructive">{state.fieldError}</p> : <p className="text-xs text-muted-foreground">Tek seferde 1-500 kart üretilebilir.</p>}
      </div>
      <div className="rounded-md border border-dashed p-3 text-xs leading-5 text-muted-foreground">
        <ShieldCheck aria-hidden="true" className="mb-2 size-4" />
        QR bağlantıları güvenlik nedeniyle veritabanında düz metin olarak saklanmaz. CSV ve QR ZIP dosyalarını üretim sonrasında indirip güvenli biçimde saklayın; daha sonra yeniden oluşturulamaz.
      </div>
      {state.message ? <p role="status" className={state.status === "success" ? "rounded-md bg-emerald-50 p-3 text-sm text-emerald-800" : "rounded-md bg-destructive/10 p-3 text-sm text-destructive"}>{state.message}</p> : null}
      <Button type="submit" disabled={pending}>{pending ? "Üretiliyor..." : "QR Kartları Üret"}</Button>
      {state.csv ? <div className="grid gap-2"><Button type="button" variant="outline" onClick={downloadCsv}><Download aria-hidden="true" />CSV&apos;yi İndir</Button><Button type="button" variant="outline" onClick={downloadZip} disabled={zipPending}><Archive aria-hidden="true" />{zipPending ? "QR görselleri hazırlanıyor..." : "QR Görsellerini İndir (.zip)"}</Button>{zipError ? <p role="alert" className="text-xs text-destructive">{zipError}</p> : null}</div> : null}
    </form>
  );
}
