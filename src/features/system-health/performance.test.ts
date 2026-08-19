import { describe, expect, it } from "vitest";
import { calculateRunDurationMs, deriveLatencyHealth, PERFORMANCE_BUDGETS, summarizeDurations } from "./performance";

describe("performance health derivation", () => {
  it("marks a failed DB probe as failed", () => expect(deriveLatencyHealth(null, true, PERFORMANCE_BUDGETS.databaseProbe)).toBe("FAILED"));
  it("marks a slow DB probe as warning or degraded", () => { expect(deriveLatencyHealth(300, false, PERFORMANCE_BUDGETS.databaseProbe)).toBe("WARNING"); expect(deriveLatencyHealth(900, false, PERFORMANCE_BUDGETS.databaseProbe)).toBe("DEGRADED"); });
  it("never promotes unknown timing to healthy", () => expect(deriveLatencyHealth(null, false, PERFORMANCE_BUDGETS.databaseProbe)).toBe("UNKNOWN"));
  it("calculates Academy duration and safe trend statistics", () => {
    const first = { startedAt: new Date("2026-08-19T00:00:00Z"), finishedAt: new Date("2026-08-19T00:00:10Z") };
    const second = { startedAt: new Date("2026-08-19T01:00:00Z"), finishedAt: new Date("2026-08-19T01:00:30Z") };
    expect(calculateRunDurationMs(first)).toBe(10_000);
    expect(summarizeDurations([first, second])).toEqual({ sampleCount: 2, minMs: 10_000, averageMs: 20_000, maxMs: 30_000 });
  });
});
