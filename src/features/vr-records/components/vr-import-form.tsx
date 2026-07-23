"use client";

import { CheckCircle2, FileSpreadsheet, Upload, XCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { importVrRecordsAction } from "@/features/vr-records/actions/import-vr-records-action";

type Result = Awaited<ReturnType<typeof importVrRecordsAction>>;

export function VrImportForm() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (commit: boolean) => {
    if (!file) return;
    const data = new FormData();
    data.set("file", file);
    if (commit) data.set("commit", "true");
    startTransition(async () => setResult(await importVrRecordsAction(data)));
  };

  return (
    <div className="grid gap-5">
      <div className="relative grid min-h-44 place-items-center rounded-lg border border-dashed border-primary/30 bg-secondary/45 p-6 text-center transition-colors hover:border-primary/50 hover:bg-secondary/65">
        <div>
          <span className="mx-auto grid size-12 place-items-center rounded-md border border-primary/15 bg-background text-primary shadow-sm">
            <FileSpreadsheet aria-hidden="true" className="size-5" />
          </span>
          <label htmlFor="vr-csv" className="mt-4 block text-sm font-semibold">VR kayıt CSV dosyasını seçin</label>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">firstName, lastName, school, phone başlıkları · En fazla 500 satır ve 2 MB</p>
          <Input
            id="vr-csv"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setResult(null);
            }}
            disabled={pending}
            className="mx-auto mt-4 max-w-sm bg-background"
          />
          {file ? <p className="mt-3 text-xs font-medium text-primary">{file.name}</p> : null}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" onClick={() => run(false)} disabled={!file || pending}><Upload aria-hidden="true" />Önizle</Button>
        {result?.ok && result.preview ? <Button type="button" onClick={() => run(true)} disabled={pending}>Onayla ve içe aktar</Button> : null}
      </div>

      {result ? (
        <div role="status" className={`rounded-lg border p-5 ${result.ok ? "border-emerald-200 bg-emerald-50/70" : "border-red-200 bg-red-50/70"}`}>
          <div className="flex items-start gap-3">
            {result.ok ? <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-emerald-700" /> : <XCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-red-700" />}
            <p className="font-semibold">{result.ok ? `${result.validCount} geçerli kayıt bulundu.` : result.message}</p>
          </div>
          {!result.ok && result.errors.length ? (
            <ul className="mt-4 max-h-64 space-y-1 overflow-auto border-t border-red-200 pt-4 text-sm text-red-800">
              {result.errors.map((error) => <li key={`${error.rowNumber}-${error.message}`}>Satır {error.rowNumber}: {error.message}</li>)}
            </ul>
          ) : null}
          {result.ok && result.rows.length ? (
            <div className="mt-4 max-h-64 space-y-1 overflow-auto border-t border-emerald-200 pt-4 text-sm">
              {result.rows.map((row) => <p key={row.rowNumber}>{row.rowNumber}. {row.firstName} {row.lastName} · {row.school}</p>)}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
