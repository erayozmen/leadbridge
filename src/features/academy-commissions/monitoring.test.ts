import { describe, expect, it } from "vitest";
import { ACADEMY_SYNC_TIME_ZONE, getNextAcademySyncTime } from "./schedule";
describe("Academy synchronization schedule", () => {
  it("calculates the next run in Europe/Istanbul", () => { expect(ACADEMY_SYNC_TIME_ZONE).toBe("Europe/Istanbul"); expect(getNextAcademySyncTime(new Date("2026-08-18T07:15:00.000Z")).toISOString()).toBe("2026-08-18T09:00:00.000Z"); });
  it("moves midnight safely to the next local day", () => { expect(getNextAcademySyncTime(new Date("2026-08-18T18:01:00.000Z")).toISOString()).toBe("2026-08-18T21:00:00.000Z"); });
});
