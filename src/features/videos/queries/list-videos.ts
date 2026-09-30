import "server-only";

import { VideoStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const VIDEO_LIST_LIMIT = 500;

/** Lists library videos; archived ones only on request. Storage paths are not exposed to the UI. */
export async function listVideos({ includeArchived = false }: { includeArchived?: boolean } = {}) {
  const videos = await prisma.video.findMany({
    where: includeArchived ? {} : { status: { not: VideoStatus.ARCHIVED } },
    orderBy: { createdAt: "desc" },
    take: VIDEO_LIST_LIMIT,
    select: {
      id: true,
      displayName: true,
      originalFilename: true,
      sizeBytes: true,
      mimeType: true,
      status: true,
      createdAt: true,
      uploadedByUser: { select: { fullName: true } },
    },
  });
  return videos.map(({ sizeBytes, uploadedByUser, ...video }) => ({
    ...video,
    sizeBytes: Number(sizeBytes),
    uploadedBy: uploadedByUser.fullName,
  }));
}

export type VideoListItem = Awaited<ReturnType<typeof listVideos>>[number];

/** READY videos that can be sent to a headset; used by the device controls. */
export function listPlayableVideos() {
  return prisma.video.findMany({
    where: { status: VideoStatus.READY },
    orderBy: { displayName: "asc" },
    take: VIDEO_LIST_LIMIT,
    select: { id: true, displayName: true },
  });
}

export type PlayableVideo = Awaited<ReturnType<typeof listPlayableVideos>>[number];
