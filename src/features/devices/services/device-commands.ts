import "server-only";

import { DeviceCommandStatus, DeviceCommandType, DeviceStatus, VideoStatus } from "@prisma/client";
import { z } from "zod";

import { AUDIT_ACTIONS } from "@/features/audit/constants/audit-actions";
import { AUDIT_ENTITY_TYPES } from "@/features/audit/constants/audit-entity-types";
import { writeAuditLog } from "@/features/audit/services/write-audit-log";
import { requireAdmin } from "@/features/auth/server/auth";
import { isDeviceOnline, OPEN_COMMAND_STATUSES } from "@/features/devices/lib/command-policy";
import { DeviceError } from "@/features/devices/services/device-errors";
import { lockDevice } from "@/features/devices/services/pairing-code";
import { prisma } from "@/lib/prisma";

const id = z.string().trim().min(1).max(64);
const playSchema = z.object({ deviceId: id, videoId: id }).strict();
const stopSchema = z.object({ deviceId: id }).strict();

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function createCommand(
  tx: TransactionClient,
  actorId: string,
  deviceId: string,
  type: DeviceCommandType,
  video: { id: string; displayName: string } | null,
  now: Date,
) {
  await lockDevice(tx, deviceId);
  const device = await tx.device.findUnique({ where: { id: deviceId }, select: { status: true, lastSeenAt: true } });
  if (!device) throw new DeviceError("DEVICE_NOT_FOUND");
  if (device.status !== DeviceStatus.ACTIVE) throw new DeviceError("DEVICE_STATE_CONFLICT");
  // A command for an offline headset would run at an unexpected moment later; refuse it instead.
  if (!isDeviceOnline(device.lastSeenAt, now)) throw new DeviceError("DEVICE_OFFLINE");

  // Each headset runs one command at a time; a new command supersedes whatever is still open.
  // Only this device's commands are touched, so headsets stay fully independent.
  const superseded = await tx.deviceCommand.updateMany({
    where: { deviceId, status: { in: [...OPEN_COMMAND_STATUSES] } },
    data: { status: DeviceCommandStatus.CANCELLED },
  });
  const command = await tx.deviceCommand.create({
    data: { deviceId, type, videoId: video?.id ?? null, createdByUserId: actorId },
    select: { id: true },
  });
  await writeAuditLog(tx, {
    actor: { type: "USER", userId: actorId },
    action: AUDIT_ACTIONS.DEVICE_COMMAND_CREATED,
    entityType: AUDIT_ENTITY_TYPES.DEVICE,
    entityId: deviceId,
    ...(video ? { relatedEntity: { type: AUDIT_ENTITY_TYPES.VIDEO, id: video.id } } : {}),
    afterData: { commandId: command.id, type, ...(video ? { videoName: video.displayName } : {}) },
    metadata: { supersededCommandCount: superseded.count },
  });
  return command;
}

/** Queues "download if needed, then play" of a READY library video on one ACTIVE, online headset. */
export async function sendPlayVideoCommand(input: unknown, now = new Date()): Promise<{ commandId: string }> {
  const { deviceId, videoId } = playSchema.parse(input);
  const actor = await requireAdmin();

  return prisma.$transaction(async (tx) => {
    const video = await tx.video.findUnique({ where: { id: videoId }, select: { id: true, displayName: true, status: true } });
    if (!video || video.status !== VideoStatus.READY) throw new DeviceError("VIDEO_NOT_AVAILABLE");
    const command = await createCommand(tx, actor.id, deviceId, DeviceCommandType.PLAY_VIDEO, video, now);
    return { commandId: command.id };
  });
}

/** Queues a stop of whatever the headset is playing. */
export async function sendStopCommand(input: unknown, now = new Date()): Promise<{ commandId: string }> {
  const { deviceId } = stopSchema.parse(input);
  const actor = await requireAdmin();

  return prisma.$transaction(async (tx) => {
    const command = await createCommand(tx, actor.id, deviceId, DeviceCommandType.STOP, null, now);
    return { commandId: command.id };
  });
}
