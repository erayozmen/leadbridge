import { QrCodeStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { listQrCodes, QR_CODES_PAGE_SIZE, type ListQrCodesDependencies } from "@/features/qr-codes/queries/list-qr-codes";

vi.mock("server-only", () => ({}));

function dependencies(): ListQrCodesDependencies {
  return { count: vi.fn(async () => 42), findMany: vi.fn(async () => []) };
}

describe("listQrCodes", () => {
  it("shows only active records by default", async () => {
    const deps = dependencies();
    await listQrCodes({}, deps);
    expect(deps.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { archivedAt: null } }));
  });
  it("shows only archived records when requested", async () => {
    const deps = dependencies();
    await listQrCodes({ archive: "archived" }, deps);
    expect(deps.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { archivedAt: { not: null } } }));
  });
  it("does not apply an archive condition for all records", async () => {
    const deps = dependencies();
    await listQrCodes({ archive: "all" }, deps);
    expect(deps.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });
  it("applies the status filter", async () => {
    const deps = dependencies();
    await listQrCodes({ status: QrCodeStatus.CREATED }, deps);
    expect(deps.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { archivedAt: null, status: QrCodeStatus.CREATED } }));
  });
  it("applies a case-insensitive serial number filter", async () => {
    const deps = dependencies();
    await listQrCodes({ serialNumber: "LB-0001" }, deps);
    expect(deps.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { archivedAt: null, serialNumber: { contains: "LB-0001", mode: "insensitive" } } }));
  });
  it("calculates pagination skip and take", async () => {
    const deps = dependencies();
    await listQrCodes({ page: 3 }, deps);
    expect(deps.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 40, take: QR_CODES_PAGE_SIZE }));
  });
});
