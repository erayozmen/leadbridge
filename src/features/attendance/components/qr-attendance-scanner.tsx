"use client";

import { Camera, Keyboard, ScanLine, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { scanAttendanceAction } from "@/features/attendance/actions/scanner-action";

type Detector = { detect(source: ImageBitmapSource): Promise<Array<{ rawValue: string }>> };
type DetectorConstructor = new (options: { formats: string[] }) => Detector;

function tokenFromValue(value: string) {
  try {
    const url = new URL(value);
    const parts = url.pathname.split("/").filter(Boolean);
    return parts[0] === "r" ? parts[1] ?? "" : value.trim();
  } catch {
    return value.trim();
  }
}

export function QrAttendanceScanner() {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [message, setMessage] = useState("Kamerayı başlatın veya QR bağlantısını girin.");
  const [manual, setManual] = useState("");
  const [active, setActive] = useState(false);
  const [pending, startTransition] = useTransition();

  const submit = (value: string) => {
    const token = tokenFromValue(value);
    if (!token || pending) return;
    startTransition(async () => {
      const result = await scanAttendanceAction(token);
      setMessage(result.ok ? `${result.studentName} katıldı olarak işaretlendi.` : result.message);
    });
  };

  useEffect(() => () => stream.current?.getTracks().forEach((track) => track.stop()), []);

  async function start() {
    try {
      const DetectorApi = (window as unknown as { BarcodeDetector?: DetectorConstructor }).BarcodeDetector;
      if (!DetectorApi) {
        setMessage("Bu tarayıcı kamera ile QR okumayı desteklemiyor. Manuel girişi kullanın.");
        return;
      }
      stream.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      if (video.current) {
        video.current.srcObject = stream.current;
        await video.current.play();
      }
      setActive(true);
      const detector = new DetectorApi({ formats: ["qr_code"] });
      const tick = async () => {
        if (!video.current || !stream.current) return;
        try {
          const values = await detector.detect(video.current);
          if (values[0]?.rawValue) {
            stream.current.getTracks().forEach((track) => track.stop());
            stream.current = null;
            setActive(false);
            submit(values[0].rawValue);
            return;
          }
        } catch {}
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    } catch {
      setMessage("Kamera izni alınamadı. Tarayıcı ayarlarını kontrol edin veya manuel girişi kullanın.");
    }
  }

  return (
    <div className="grid gap-5">
      <div className="relative aspect-video overflow-hidden rounded-lg border-4 border-slate-900 bg-slate-950 shadow-[0_18px_40px_rgb(15_23_42/0.20)]">
        <video ref={video} playsInline muted className="size-full object-cover" />
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="grid size-28 place-items-center rounded-lg border border-emerald-300/60 bg-black/15 shadow-[inset_0_0_24px_rgb(52_211_153/0.12)]">
            <ScanLine className="size-16 text-emerald-200/85" aria-hidden="true" />
          </span>
        </div>
        <span className="absolute top-3 left-3 rounded-md border border-white/10 bg-black/45 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
          {active ? "Kamera açık" : "Tarayıcı hazır"}
        </span>
      </div>

      <div role="status" className="flex items-start gap-3 rounded-md border border-emerald-200/70 bg-emerald-50/80 p-4 text-sm text-emerald-950">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-emerald-700" />
        <span>{pending ? "Katılım doğrulanıyor..." : message}</span>
      </div>

      <Button type="button" className="h-12 w-full" onClick={start} disabled={active || pending}>
        <Camera aria-hidden="true" /> {active ? "Kamera açık" : "Kamerayı başlat"}
      </Button>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit(manual);
        }}
        className="grid gap-3 rounded-lg border bg-card/90 p-4 shadow-sm"
      >
        <div>
          <label htmlFor="manual-token" className="text-sm font-semibold">Manuel QR bağlantısı</label>
          <p className="mt-1 text-xs text-muted-foreground">Kamera kullanılamıyorsa QR bağlantısını güvenli biçimde işleyin.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input id="manual-token" value={manual} onChange={(event) => setManual(event.target.value)} autoComplete="off" placeholder="QR bağlantısını yapıştırın" disabled={pending} className="h-11" />
          <Button className="h-11 sm:shrink-0" disabled={pending || !manual.trim()}><Keyboard aria-hidden="true" />İşle</Button>
        </div>
      </form>
    </div>
  );
}
