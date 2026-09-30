import { DeviceStatus, UserRole, type DeviceCommandStatus } from "@prisma/client";
import { Headset } from "lucide-react";

import { DashboardPage, DashboardSection } from "@/components/dashboard/dashboard-page";
import { PageHeader } from "@/components/dashboard/page-header";
import { DataEmptyState } from "@/components/shared/data-surface";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireStaffOrAdmin } from "@/features/auth/server/auth";
import { DevicePairingForm } from "@/features/devices/components/device-pairing-form";
import { DeviceRowActions } from "@/features/devices/components/device-row-actions";
import { DeviceStatusAutoRefresh, DeviceVideoControls } from "@/features/devices/components/device-video-controls";
import { COMMAND_STATUS_LABELS, COMMAND_TYPE_LABELS, effectiveCommandStatus, PLAYBACK_STATE_LABELS } from "@/features/devices/lib/command-labels";
import { isDeviceOnline } from "@/features/devices/lib/command-policy";
import { PAIRING_CODE_TTL_HOURS } from "@/features/devices/lib/pairing-policy";
import { listDevices, type DeviceListItem } from "@/features/devices/queries/list-devices";
import { listPlayableVideos } from "@/features/videos/queries/list-videos";

const dateTime = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" });
const statuses: Record<DeviceStatus, { label: string; variant: "warning" | "success" | "destructive" }> = {
  PENDING: { label: "Eşleşme bekliyor", variant: "warning" },
  ACTIVE: { label: "Aktif", variant: "success" },
  DISABLED: { label: "Kaldırıldı (devre dışı)", variant: "destructive" },
};

function DeviceStatusBadge({ status }: { status: DeviceStatus }) {
  const { label, variant } = statuses[status];
  return <Badge variant={variant}><span aria-hidden="true" className="size-1.5 rounded-full bg-current opacity-70" />{label}</Badge>;
}

const IN_FLIGHT: readonly DeviceCommandStatus[] = ["PENDING", "DELIVERED", "DOWNLOADING"];

function ConnectionStatus({ lastSeenAt, now }: { lastSeenAt: Date | null; now: Date }) {
  if (!lastSeenAt) return <span className="text-sm text-muted-foreground">Henüz bağlanmadı</span>;
  const online = isDeviceOnline(lastSeenAt, now);
  return <div className="grid gap-0.5">
    <span className={online ? "text-sm font-medium text-emerald-700" : "text-sm text-muted-foreground"}>{online ? "Çevrimiçi" : "Çevrimdışı"}</span>
    <span className="text-xs text-muted-foreground">{dateTime.format(lastSeenAt)}</span>
  </div>;
}

/** Current playback of the headset and the state of the latest command sent to it. */
function PlaybackStatus({ device, now }: { device: DeviceListItem; now: Date }) {
  const command = device.commands[0];
  const status = command ? effectiveCommandStatus(command, now) : null;
  const tone = status === "FAILED" ? "text-destructive" : status === "PLAYING" ? "text-emerald-700" : status === "DOWNLOADING" ? "text-amber-700" : "text-muted-foreground";
  return <div className="grid gap-0.5 whitespace-normal">
    <span className="text-sm">
      {PLAYBACK_STATE_LABELS[device.playbackState]}
      {device.currentVideo ? <>: <span className="font-medium">{device.currentVideo.displayName}</span></> : null}
    </span>
    {command && status ? <span className={`text-xs ${tone}`}>
      Son komut ({COMMAND_TYPE_LABELS[command.type]}{command.video ? ` · ${command.video.displayName}` : ""}): {COMMAND_STATUS_LABELS[status]}
      {status === "FAILED" && command.error ? ` (${command.error})` : ""}
    </span> : null}
  </div>;
}

export default async function DevicesPage() {
  const user = await requireStaffOrAdmin();
  // Sending library videos is admin-only, like the video library itself.
  const canControl = user.role === UserRole.ADMIN;
  const [devices, playableVideos] = await Promise.all([listDevices(), canControl ? listPlayableVideos() : Promise.resolve([])]);
  const now = new Date();
  const commandInFlight = devices.some((device) => device.commands[0] && IN_FLIGHT.includes(effectiveCommandStatus(device.commands[0], now)));

  return <DashboardPage>
    <DeviceStatusAutoRefresh active={commandInFlight} />
    <PageHeader icon={Headset} title="Cihazlar" description="Meta Quest cihazlarını eşleştirin ve bağlantı durumlarını izleyin." />
    <DashboardSection className="grid min-w-0 items-start gap-6 2xl:grid-cols-[22rem_minmax(0,1fr)]">
      <Card><CardHeader><CardTitle>Cihaz eşleştir</CardTitle><CardDescription>Yeni bir cihaz için {PAIRING_CODE_TTL_HOURS} saat geçerli eşleştirme kodu oluşturun. Bekleyen cihazın kodu dolduysa listeden &quot;Kodu Yenile&quot;yi kullanın.</CardDescription></CardHeader><CardContent><DevicePairingForm /></CardContent></Card>
      <Card className="gap-0 overflow-hidden py-0">
        {devices.length ? <Table><TableHeader><TableRow><TableHead>Cihaz</TableHead><TableHead>Seri No</TableHead><TableHead>Model</TableHead><TableHead>Durum</TableHead><TableHead>Uygulama</TableHead><TableHead>Son Görülme</TableHead><TableHead>Şu an</TableHead>{canControl ? <TableHead>Video</TableHead> : null}<TableHead>İşlem</TableHead></TableRow></TableHeader><TableBody>{devices.map((device) => <TableRow key={device.id}><TableCell className="font-medium">{device.name}</TableCell><TableCell className="font-mono text-xs">{device.serialNumber ?? "—"}</TableCell><TableCell>{device.model ?? "—"}</TableCell><TableCell><DeviceStatusBadge status={device.status} /></TableCell><TableCell>{device.appVersion ?? "—"}</TableCell><TableCell><ConnectionStatus lastSeenAt={device.lastSeenAt} now={now} /></TableCell><TableCell className="max-w-64">{device.status === DeviceStatus.ACTIVE ? <PlaybackStatus device={device} now={now} /> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>{canControl ? <TableCell>{device.status === DeviceStatus.ACTIVE ? <DeviceVideoControls deviceId={device.id} deviceName={device.name} videos={playableVideos} /> : <span className="text-xs text-muted-foreground">—</span>}</TableCell> : null}<TableCell><DeviceRowActions deviceId={device.id} status={device.status} /></TableCell></TableRow>)}</TableBody></Table> : <DataEmptyState icon={Headset} title="Henüz cihaz eklenmedi." description="İlk cihazınızı soldaki formdan eşleştirme kodu oluşturarak ekleyebilirsiniz." />}
      </Card>
    </DashboardSection>
  </DashboardPage>;
}
