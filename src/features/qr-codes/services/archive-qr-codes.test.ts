import { QrCodeStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { AuthError } from "@/features/auth/types/auth";
import { archiveAllDisabledQrCodes, archiveQrCode, type ArchiveQrCodesDependencies } from "@/features/qr-codes/services/archive-qr-codes";

vi.mock("server-only", () => ({}));

function dependencies(overrides: Partial<ArchiveQrCodesDependencies> = {}): ArchiveQrCodesDependencies {
  return {
    requireAdmin: vi.fn(async () => ({})),
    findQrCode: vi.fn(async () => ({ id: "qr_1", status: QrCodeStatus.DISABLED, archivedAt: null, hasVrRecord: false, hasRegistration: false })),
    archiveOne: vi.fn(async () => 1),
    archiveAll: vi.fn(async () => 3),
    ...overrides,
  };
}

describe("archiveQrCode", () => {
  it("archives an unrelated DISABLED card", async () => { await expect(archiveQrCode("qr_1", dependencies())).resolves.toMatchObject({ ok: true, archivedCount: 1 }); });
  it("rejects STAFF", async () => { await expect(archiveQrCode("qr_1", dependencies({ requireAdmin: vi.fn(async () => { throw new AuthError("FORBIDDEN"); }) }))).resolves.toMatchObject({ ok: false, code: "UNAUTHORIZED" }); });
  it("rejects invalid ids before lookup", async () => { const deps = dependencies(); await expect(archiveQrCode("", deps)).resolves.toMatchObject({ ok: false, code: "INVALID_INPUT" }); expect(deps.findQrCode).not.toHaveBeenCalled(); });
  for (const status of [QrCodeStatus.CREATED, QrCodeStatus.ASSIGNED, QrCodeStatus.USED]) {
    it(`rejects ${status} cards`, async () => { await expect(archiveQrCode("qr_1", dependencies({ findQrCode: vi.fn(async () => ({ id: "qr_1", status, archivedAt: null, hasVrRecord: false, hasRegistration: false })) }))).resolves.toMatchObject({ ok: false, code: "QR_NOT_ARCHIVABLE" }); });
  }
  it("rejects a card assigned to a VR record", async () => { await expect(archiveQrCode("qr_1", dependencies({ findQrCode: vi.fn(async () => ({ id: "qr_1", status: QrCodeStatus.DISABLED, archivedAt: null, hasVrRecord: true, hasRegistration: false })) }))).resolves.toMatchObject({ ok: false, code: "QR_NOT_ARCHIVABLE" }); });
  it("rejects a card with a registration", async () => { await expect(archiveQrCode("qr_1", dependencies({ findQrCode: vi.fn(async () => ({ id: "qr_1", status: QrCodeStatus.DISABLED, archivedAt: null, hasVrRecord: false, hasRegistration: true })) }))).resolves.toMatchObject({ ok: false, code: "QR_NOT_ARCHIVABLE" }); });
  it("rejects an already archived card", async () => { await expect(archiveQrCode("qr_1", dependencies({ findQrCode: vi.fn(async () => ({ id: "qr_1", status: QrCodeStatus.DISABLED, archivedAt: new Date(), hasVrRecord: false, hasRegistration: false })) }))).resolves.toMatchObject({ ok: false, code: "QR_NOT_ARCHIVABLE" }); });
  it("uses a server-created archive timestamp", async () => { const deps = dependencies(); await archiveQrCode("qr_1", deps); expect(deps.archiveOne).toHaveBeenCalledWith("qr_1", expect.any(Date)); });
  it("maps a lost conditional update to conflict", async () => { await expect(archiveQrCode("qr_1", dependencies({ archiveOne: vi.fn(async () => 0) }))).resolves.toMatchObject({ ok: false, code: "ARCHIVE_CONFLICT" }); });
  it("does not leak raw database errors", async () => { const result = await archiveQrCode("qr_1", dependencies({ archiveOne: vi.fn(async () => { throw new Error("secret raw error"); }) })); expect(result).toMatchObject({ ok: false, code: "ARCHIVE_FAILED" }); expect(JSON.stringify(result)).not.toContain("secret raw error"); });
});

describe("archiveAllDisabledQrCodes", () => {
  it("returns the number archived by the safe bulk operation", async () => { await expect(archiveAllDisabledQrCodes(dependencies())).resolves.toMatchObject({ ok: true, archivedCount: 3 }); });
  it("rejects STAFF bulk requests", async () => { await expect(archiveAllDisabledQrCodes(dependencies({ requireAdmin: vi.fn(async () => { throw new AuthError("FORBIDDEN"); }) }))).resolves.toMatchObject({ ok: false, code: "UNAUTHORIZED" }); });
  it("uses a server timestamp for bulk archive", async () => { const deps = dependencies(); await archiveAllDisabledQrCodes(deps); expect(deps.archiveAll).toHaveBeenCalledWith(expect.any(Date)); });
});
