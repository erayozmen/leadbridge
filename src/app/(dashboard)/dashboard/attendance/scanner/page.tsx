import { ScanLine } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/page-header";
import { requireStaffOrAdmin } from "@/features/auth/server/auth";
import { QrAttendanceScanner } from "@/features/attendance/components/qr-attendance-scanner";

export default async function AttendanceScannerPage(){await requireStaffOrAdmin();return <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6"><PageHeader icon={ScanLine} title="QR Katılım Tarayıcı" description="Öğrenci QR kartını kameraya göstererek katılımı hızlıca işleyin."/><Card className="mt-8 p-5 sm:p-6"><QrAttendanceScanner/></Card></main>;}
