import { AcademySyncRunSource } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ runSync: vi.fn().mockResolvedValue({ skipped: false }) }));
vi.mock("@/features/academy-commissions/sync", () => ({ runAcademyCommissionSync: mocks.runSync }));
import { GET } from "./route";
const original = process.env.CRON_SECRET;
afterEach(() => { if (original === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = original; });
describe("Academy cron source", () => { it("records scheduled runs as CRON", async () => { process.env.CRON_SECRET = "secret"; const response = await GET(new Request("http://test", { headers: { authorization: "Bearer secret" } })); expect(response.status).toBe(200); expect(mocks.runSync).toHaveBeenCalledWith(AcademySyncRunSource.CRON); }); });
