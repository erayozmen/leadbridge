import { DeviceStatus } from "@prisma/client";
import { Headset } from "lucide-react";

import { DashboardPage, DashboardSection } from "@/components/dashboard/dashboard-page";
import { PageHeader } from "@/components/dashboard/page-header";
import { DataEmptyState } from "@/components/shared/data-surface";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireStaffOrAdmin } from "@/features/auth/server/auth";
import { DevicePairingForm } from "@/features/devices/components/device-pairing-form";
import { listDevices } from "@/features/devices/queries/list-devices";

const dateTime = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" });
const statuses: Record<DeviceStatus, { label: string; variant: "warning" | "success" | "destructive" }> = {
  PENDING: { label: "Eşleşme bekliyor", variant: "warning" },
  ACTIVE: { label: "Aktif", variant: "success" },
  DISABLED: { label: "Devre dışı", variant: "destructive" },
};

function DeviceStatusBadge({ status }: { status: DeviceStatus }) {
  const { label, variant } = statuses[status];
  return <Badge variant={variant}><span aria-hidden="true" className="size-1.5 rounded-full bg-current opacity-70" />{label}</Badge>;
}

export default async function DevicesPage() {
  await requireStaffOrAdmin();
  const devices = await listDevices();

  return <DashboardPage>
    <PageHeader icon={Headset} title="Cihazlar" description="Meta Quest cihazlarını eşleştirin ve bağlantı durumlarını izleyin." />
    <DashboardSection className="grid min-w-0 items-start gap-6 2xl:grid-cols-[22rem_minmax(0,1fr)]">
      <Card><CardHeader><CardTitle>Cihaz eşleştir</CardTitle><CardDescription>Yeni bir cihaz için 15 dakika geçerli eşleştirme kodu oluşturun.</CardDescription></CardHeader><CardContent><DevicePairingForm /></CardContent></Card>
      <Card className="gap-0 overflow-hidden py-0">
        {devices.length ? <Table><TableHeader><TableRow><TableHead>Cihaz</TableHead><TableHead>Seri No</TableHead><TableHead>Model</TableHead><TableHead>Durum</TableHead><TableHead>Uygulama</TableHead><TableHead>Son Görülme</TableHead></TableRow></TableHeader><TableBody>{devices.map((device) => <TableRow key={device.id}><TableCell className="font-medium">{device.name}</TableCell><TableCell className="font-mono text-xs">{device.serialNumber ?? "—"}</TableCell><TableCell>{device.model ?? "—"}</TableCell><TableCell><DeviceStatusBadge status={device.status} /></TableCell><TableCell>{device.appVersion ?? "—"}</TableCell><TableCell>{device.lastSeenAt ? dateTime.format(device.lastSeenAt) : "Henüz bağlanmadı"}</TableCell></TableRow>)}</TableBody></Table> : <DataEmptyState icon={Headset} title="Henüz cihaz eklenmedi." description="İlk cihazınızı soldaki formdan eşleştirme kodu oluşturarak ekleyebilirsiniz." />}
      </Card>
    </DashboardSection>
  </DashboardPage>;
}
