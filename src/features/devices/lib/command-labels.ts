// Client-safe Turkish labels for the device dashboard.
import type { DeviceCommandStatus, DeviceCommandType, DevicePlaybackState } from "@prisma/client";

import { isPendingCommandExpired } from "@/features/devices/lib/command-policy";

export const COMMAND_STATUS_LABELS: Record<DeviceCommandStatus, string> = {
  PENDING: "Bekliyor",
  DELIVERED: "Cihaz aldı",
  DOWNLOADING: "İndiriyor",
  PLAYING: "Oynatıyor",
  COMPLETED: "Tamamlandı",
  FAILED: "Hata",
  CANCELLED: "İptal edildi",
  EXPIRED: "Süresi doldu",
};

export const COMMAND_TYPE_LABELS: Record<DeviceCommandType, string> = {
  PLAY_VIDEO: "Oynat",
  STOP: "Durdur",
};

export const PLAYBACK_STATE_LABELS: Record<DevicePlaybackState, string> = {
  IDLE: "Boşta",
  DOWNLOADING: "İndiriyor",
  PLAYING: "Oynatıyor",
  PAUSED: "Duraklatıldı",
  STOPPED: "Durduruldu",
  ERROR: "Hata",
};

/** PENDING commands past their TTL are shown as expired before the next heartbeat marks them. */
export function effectiveCommandStatus(command: { status: DeviceCommandStatus; createdAt: Date }, now = new Date()): DeviceCommandStatus {
  return command.status === "PENDING" && isPendingCommandExpired(command.createdAt, now) ? "EXPIRED" : command.status;
}
