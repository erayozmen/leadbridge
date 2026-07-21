import { Card } from "@/components/ui/card";
import { requireStaffOrAdmin } from "@/features/auth/server/auth";
import { QrAttendanceScanner } from "@/features/attendance/components/qr-attendance-scanner";

export default async function AttendanceScannerPage(){await requireStaffOrAdmin();return <main className="mx-auto w-full max-w-xl px-4 py-8 sm:px-6"><h1 className="text-3xl font-semibold">QR Katılım Tarayıcı</h1><p className="mt-2 text-muted-foreground">Öğrenci QR kartını kameraya göstererek katılımı hızlıca işleyin.</p><Card className="mt-8 p-5"><QrAttendanceScanner/></Card></main>;}
