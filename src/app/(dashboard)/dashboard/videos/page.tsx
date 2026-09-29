import { VideoStatus } from "@prisma/client";
import { Film } from "lucide-react";
import Link from "next/link";

import { DashboardPage, DashboardSection } from "@/components/dashboard/dashboard-page";
import { PageHeader } from "@/components/dashboard/page-header";
import { DataEmptyState } from "@/components/shared/data-surface";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdmin } from "@/features/auth/server/auth";
import { ArchiveVideoButton } from "@/features/videos/components/archive-video-button";
import { VideoUpload } from "@/features/videos/components/video-upload";
import { formatBytes } from "@/features/videos/lib/video-file";
import { VIDEO_MAX_UPLOAD_BYTES } from "@/features/videos/lib/video-policy";
import { listVideos } from "@/features/videos/queries/list-videos";

const dateTime = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" });
const statuses: Record<VideoStatus, { label: string; variant: "warning" | "success" | "destructive" | "secondary" }> = {
  UPLOADING: { label: "Yükleniyor", variant: "warning" },
  READY: { label: "Hazır", variant: "success" },
  FAILED: { label: "Hatalı", variant: "destructive" },
  ARCHIVED: { label: "Arşivlendi", variant: "secondary" },
};

function VideoStatusBadge({ status }: { status: VideoStatus }) {
  const { label, variant } = statuses[status];
  return <Badge variant={variant}><span aria-hidden="true" className="size-1.5 rounded-full bg-current opacity-70" />{label}</Badge>;
}

export default async function VideosPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const includeArchived = (await searchParams).archived === "1";
  const videos = await listVideos({ includeArchived });

  return <DashboardPage>
    <PageHeader icon={Film} title="Videolar" description="Quest cihazlarına gönderilecek videoların merkezi kütüphanesi." />
    <DashboardSection className="grid min-w-0 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Video yükle</CardTitle>
          <CardDescription>MP4, M4V veya MOV; en fazla {formatBytes(VIDEO_MAX_UPLOAD_BYTES)}. Dosya doğrudan güvenli depoya yüklenir ve orijinal hâliyle saklanır; bağlantı kesilirse kaldığı yerden devam eder.</CardDescription>
        </CardHeader>
        <CardContent><VideoUpload /></CardContent>
      </Card>
      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex items-center justify-end border-b border-border/70 bg-muted/15 px-4 py-3 text-sm sm:px-5">
          <Link className="font-medium text-muted-foreground hover:text-foreground" href={includeArchived ? "/dashboard/videos" : "/dashboard/videos?archived=1"}>
            {includeArchived ? "Arşivlenenleri gizle" : "Arşivlenenleri göster"}
          </Link>
        </div>
        {videos.length ? <Table><TableHeader><TableRow><TableHead className="w-12"><span className="sr-only">Önizleme</span></TableHead><TableHead>Video</TableHead><TableHead>Dosya Adı</TableHead><TableHead>Boyut</TableHead><TableHead>Durum</TableHead><TableHead>Yüklenme</TableHead><TableHead>İşlem</TableHead></TableRow></TableHeader><TableBody>{videos.map((video) => <TableRow key={video.id}>
          <TableCell><span className="grid size-10 place-items-center rounded-md border bg-muted/40 text-muted-foreground"><Film className="size-4" aria-hidden="true" /></span></TableCell>
          <TableCell className="font-medium">{video.displayName}</TableCell>
          <TableCell className="max-w-64 truncate font-mono text-xs" title={video.originalFilename}>{video.originalFilename}</TableCell>
          <TableCell>{formatBytes(video.sizeBytes)}</TableCell>
          <TableCell><VideoStatusBadge status={video.status} /></TableCell>
          <TableCell><span>{dateTime.format(video.createdAt)}</span><br /><span className="text-xs text-muted-foreground">{video.uploadedBy}</span></TableCell>
          <TableCell>{video.status === VideoStatus.ARCHIVED ? "—" : <ArchiveVideoButton videoId={video.id} />}</TableCell>
        </TableRow>)}</TableBody></Table> : <DataEmptyState icon={Film} title={includeArchived ? "Kütüphanede video yok." : "Henüz video yüklenmedi."} description="İlk videonuzu yukarıdaki &quot;Video Yükle&quot; butonuyla ekleyebilirsiniz." />}
      </Card>
    </DashboardSection>
  </DashboardPage>;
}
