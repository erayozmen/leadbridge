import { AcademySyncRunSource } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ runSync: vi.fn(), capture: vi.fn() }));
vi.mock("@/features/academy-commissions/sync", () => ({ runAcademyCommissionSync: mocks.runSync }));
vi.mock("@/lib/monitoring/capture", () => ({ captureTechnicalException: mocks.capture }));
import { GET } from "./route";

const original = process.env.CRON_SECRET;
beforeEach(() => { vi.clearAllMocks(); mocks.runSync.mockResolvedValue({ skipped: false }); });
afterEach(() => { if (original === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = original; });

describe("Academy cron source", () => {
  it("records scheduled runs as CRON without emitting an error event", async () => {
    process.env.CRON_SECRET = "secret";
    const response = await GET(new Request("http://test", { headers: { authorization: "Bearer secret" } }));
    expect(response.status).toBe(200);
    expect(mocks.runSync).toHaveBeenCalledWith(AcademySyncRunSource.CRON);
    expect(mocks.capture).not.toHaveBeenCalled();
  });
  it("captures an unexpected cron failure without exposing request headers", async () => {
    process.env.CRON_SECRET = "secret";
    const error = new Error("database unavailable");
    mocks.runSync.mockRejectedValue(error);
    const response = await GET(new Request("http://test", { headers: { authorization: "Bearer secret" } }));
    expect(response.status).toBe(502);
    expect(mocks.capture).toHaveBeenCalledWith(error, expect.objectContaining({ feature: "academy-commission-sync", source: "CRON" }));
    expect(JSON.stringify(mocks.capture.mock.calls)).not.toContain("Bearer secret");
  });
  it("treats authorization rejection as expected and does not capture it", async () => {
    process.env.CRON_SECRET = "secret";
    const response = await GET(new Request("http://test", { headers: { authorization: "Bearer wrong" } }));
    expect(response.status).toBe(401);
    expect(mocks.capture).not.toHaveBeenCalled();
  });
});
