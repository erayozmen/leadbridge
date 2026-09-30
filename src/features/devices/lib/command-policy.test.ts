import { describe, expect, it } from "vitest";

import { effectiveCommandStatus } from "@/features/devices/lib/command-labels";
import {
  DEVICE_ONLINE_WINDOW_SECONDS,
  isAllowedCommandTransition,
  isDeviceOnline,
  isPendingCommandExpired,
  isStaleAcknowledgement,
  PENDING_COMMAND_TTL_SECONDS,
} from "@/features/devices/lib/command-policy";

const now = new Date("2026-10-01T10:00:00.000Z");
const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000);

describe("command policy", () => {
  it("allows the happy path PENDING → DELIVERED → DOWNLOADING → PLAYING → COMPLETED", () => {
    expect(isAllowedCommandTransition("PLAY_VIDEO", "PENDING", "DELIVERED")).toBe(true);
    expect(isAllowedCommandTransition("PLAY_VIDEO", "DELIVERED", "DOWNLOADING")).toBe(true);
    expect(isAllowedCommandTransition("PLAY_VIDEO", "DOWNLOADING", "PLAYING")).toBe(true);
    expect(isAllowedCommandTransition("PLAY_VIDEO", "PLAYING", "COMPLETED")).toBe(true);
    // Cache hit: straight from DELIVERED to PLAYING.
    expect(isAllowedCommandTransition("PLAY_VIDEO", "DELIVERED", "PLAYING")).toBe(true);
  });

  it.each(["COMPLETED", "FAILED", "CANCELLED", "EXPIRED"] as const)("never leaves the terminal state %s", (from) => {
    for (const to of ["DELIVERED", "DOWNLOADING", "PLAYING", "COMPLETED", "FAILED"] as const) {
      expect(isAllowedCommandTransition("PLAY_VIDEO", from, to)).toBe(false);
      expect(isAllowedCommandTransition("STOP", from, to)).toBe(false);
    }
  });

  it("does not move backwards", () => {
    expect(isAllowedCommandTransition("PLAY_VIDEO", "PLAYING", "DOWNLOADING")).toBe(false);
    expect(isAllowedCommandTransition("PLAY_VIDEO", "DOWNLOADING", "DELIVERED")).toBe(false);
    expect(isStaleAcknowledgement("PLAYING", "DELIVERED")).toBe(true);
    expect(isStaleAcknowledgement("FAILED", "DELIVERED")).toBe(false);
  });

  it("limits STOP commands to acknowledge, complete or fail", () => {
    expect(isAllowedCommandTransition("STOP", "DELIVERED", "COMPLETED")).toBe(true);
    expect(isAllowedCommandTransition("STOP", "DELIVERED", "DOWNLOADING")).toBe(false);
    expect(isAllowedCommandTransition("STOP", "DELIVERED", "PLAYING")).toBe(false);
  });

  it("decides online and expiry by time windows", () => {
    expect(isDeviceOnline(null, now)).toBe(false);
    expect(isDeviceOnline(ago(DEVICE_ONLINE_WINDOW_SECONDS), now)).toBe(true);
    expect(isDeviceOnline(ago(DEVICE_ONLINE_WINDOW_SECONDS + 1), now)).toBe(false);
    expect(isPendingCommandExpired(ago(PENDING_COMMAND_TTL_SECONDS), now)).toBe(false);
    expect(isPendingCommandExpired(ago(PENDING_COMMAND_TTL_SECONDS + 1), now)).toBe(true);
  });

  it("shows stale PENDING commands as expired in the dashboard", () => {
    expect(effectiveCommandStatus({ status: "PENDING", createdAt: ago(PENDING_COMMAND_TTL_SECONDS + 1) }, now)).toBe("EXPIRED");
    expect(effectiveCommandStatus({ status: "PENDING", createdAt: ago(5) }, now)).toBe("PENDING");
    expect(effectiveCommandStatus({ status: "DOWNLOADING", createdAt: ago(PENDING_COMMAND_TTL_SECONDS + 1) }, now)).toBe("DOWNLOADING");
  });
});
