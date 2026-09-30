// Client-safe device command policy shared by services, the dashboard and tests.
import type { DeviceCommandStatus, DeviceCommandType } from "@prisma/client";

/**
 * Commands travel with the heartbeat response, so the poll interval is the command latency.
 * The server chooses it, which keeps Vercel invocations low while idle and can be tuned without
 * shipping a new Agent build. Agents that ignore it keep their own (60 s) interval.
 */
export const IDLE_POLL_SECONDS = 15;
export const ACTIVE_POLL_SECONDS = 5;
/**
 * While a video plays nothing has to be delivered, but a STOP (or a new video) may arrive at any
 * moment; this bounds that latency without polling as fast as during delivery.
 */
export const PLAYING_POLL_SECONDS = 8;

/** A device counts as online when its last heartbeat is newer than this (3x the legacy 60 s interval). */
export const DEVICE_ONLINE_WINDOW_SECONDS = 180;

/** A command the headset has not acknowledged within this time is EXPIRED instead of played late. */
export const PENDING_COMMAND_TTL_SECONDS = 10 * 60;

/** Signed download URLs are short-lived; the Agent asks for a new one to resume after expiry. */
export const DOWNLOAD_URL_TTL_SECONDS = 15 * 60;

export const TERMINAL_COMMAND_STATUSES: readonly DeviceCommandStatus[] = ["COMPLETED", "FAILED", "CANCELLED", "EXPIRED"];
/** Commands that are superseded (CANCELLED) when a newer command is sent to the same device. */
export const OPEN_COMMAND_STATUSES: readonly DeviceCommandStatus[] = ["PENDING", "DELIVERED", "DOWNLOADING", "PLAYING"];
/** Commands the Agent still has to act on; they are (re)delivered with every heartbeat. */
export const DELIVERABLE_COMMAND_STATUSES: readonly DeviceCommandStatus[] = ["PENDING", "DELIVERED", "DOWNLOADING"];

export type ReportableStatus = "DELIVERED" | "DOWNLOADING" | "PLAYING" | "COMPLETED" | "FAILED";

/**
 * Forward-only state machine. A repeated report of the current state is accepted (idempotent);
 * terminal states never change again, so a FAILED/CANCELLED/EXPIRED command cannot start playing.
 */
const TRANSITIONS: Record<DeviceCommandType, Partial<Record<DeviceCommandStatus, readonly ReportableStatus[]>>> = {
  PLAY_VIDEO: {
    PENDING: ["DELIVERED", "DOWNLOADING", "PLAYING", "FAILED"],
    DELIVERED: ["DELIVERED", "DOWNLOADING", "PLAYING", "FAILED"],
    DOWNLOADING: ["DOWNLOADING", "PLAYING", "FAILED"],
    PLAYING: ["PLAYING", "COMPLETED", "FAILED"],
  },
  STOP: {
    PENDING: ["DELIVERED", "COMPLETED", "FAILED"],
    DELIVERED: ["DELIVERED", "COMPLETED", "FAILED"],
  },
};

export function isAllowedCommandTransition(type: DeviceCommandType, from: DeviceCommandStatus, to: ReportableStatus) {
  return TRANSITIONS[type][from]?.includes(to) ?? false;
}

/** A late or duplicated DELIVERED acknowledgement for a command that already moved on is a no-op. */
export function isStaleAcknowledgement(from: DeviceCommandStatus, to: ReportableStatus) {
  return to === "DELIVERED" && (from === "DOWNLOADING" || from === "PLAYING");
}

/**
 * The player finished (or failed) after its command was superseded. The command stays CANCELLED,
 * but the report is still the headset's latest truth about playback.
 */
export function isPlaybackEndReport(to: ReportableStatus) {
  return to === "COMPLETED" || to === "FAILED";
}

export function isDeviceOnline(lastSeenAt: Date | null, now = new Date()) {
  return lastSeenAt !== null && now.getTime() - lastSeenAt.getTime() <= DEVICE_ONLINE_WINDOW_SECONDS * 1000;
}

export function isPendingCommandExpired(createdAt: Date, now = new Date()) {
  return now.getTime() - createdAt.getTime() > PENDING_COMMAND_TTL_SECONDS * 1000;
}
