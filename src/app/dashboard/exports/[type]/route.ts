import { NextResponse } from "next/server";
import { EXPORT_TYPES, buildDataExport, type ExportType } from "@/features/exports/services/build-data-export";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  if (!EXPORT_TYPES.includes(type as ExportType)) return NextResponse.json({ error: "Geçersiz dışa aktarma türü." }, { status: 404 });
  try {
    const result = await buildDataExport(type as ExportType);
    return new NextResponse(result.csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${result.filename}"`, "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" } });
  } catch { return NextResponse.json({ error: "Dışa aktarma işlemi tamamlanamadı." }, { status: 403 }); }
}
