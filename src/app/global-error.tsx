"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { try { Sentry.captureException(error); } catch { /* Monitoring must not break recovery UI. */ } }, [error]);
  return <html lang="tr"><body><main className="grid min-h-screen place-items-center bg-background p-6"><div className="max-w-md text-center"><h1 className="text-2xl font-semibold">Beklenmeyen bir hata oluştu</h1><p className="mt-3 text-sm text-muted-foreground">İşleminiz tamamlanamadı. Yeniden deneyebilir veya sorun devam ederse yöneticinizle iletişime geçebilirsiniz.</p><button type="button" onClick={reset} className="mt-6 min-h-10 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Yeniden dene</button></div></main></body></html>;
}
