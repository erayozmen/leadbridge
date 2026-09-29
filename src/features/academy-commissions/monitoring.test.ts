import { describe, expect, it } from "vitest";
import { ACADEMY_SYNC_TIME_ZONE, getNextAcademySyncTime } from "./schedule";
describe("Academy synchronization schedule", () => {
  it("calculates the next run in Europe/Istanbul", () => { expect(ACADEMY_SYNC_TIME_ZONE).toBe("Europe/Istanbul"); expect(getNextAcademySyncTime(new Date("2026-08-18T01:15:00.000Z")).toISOString()).toBe("2026-08-18T03:00:00.000Z"); });
  it("moves to the next local day after the daily run", () => { expect(getNextAcademySyncTime(new Date("2026-08-18T03:01:00.000Z")).toISOString()).toBe("2026-08-19T03:00:00.000Z"); expect(getNextAcademySyncTime(new Date("2026-08-18T21:01:00.000Z")).toISOString()).toBe("2026-08-19T03:00:00.000Z"); });
});
