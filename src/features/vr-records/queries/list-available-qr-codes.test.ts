import { QrCodeStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { AVAILABLE_QR_PAGE_SIZE, listAvailableQrCodes, type AvailableQrDependencies } from "@/features/vr-records/queries/list-available-qr-codes";

vi.mock("server-only", () => ({}));

function dependencies(): AvailableQrDependencies {
  return { count: vi.fn(async () => 41), findMany: vi.fn(async () => []) };
}

describe("listAvailableQrCodes", () => {
  it("only requests CREATED and unassigned QR cards", async () => {
    const deps = dependencies();
    await listAvailableQrCodes({}, deps);
    expect(deps.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: QrCodeStatus.CREATED, archivedAt: null, assignedVrRecord: null } }));
  });
  it("applies a case-insensitive serial filter", async () => {
    const deps = dependencies();
    await listAvailableQrCodes({ serialNumber: "LB-0001" }, deps);
    expect(deps.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ serialNumber: { contains: "LB-0001", mode: "insensitive" } }) }));
  });
  it("calculates pagination skip and take", async () => {
    const deps = dependencies();
    await listAvailableQrCodes({ page: 3 }, deps);
    expect(deps.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 40, take: AVAILABLE_QR_PAGE_SIZE }));
  });
});
