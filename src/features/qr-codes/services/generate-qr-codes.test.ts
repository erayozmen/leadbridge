import { Prisma, QrCodeStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { hashQrToken } from "@/features/qr-registration/lib/hash-qr-token";
import { generateQrCodes, type GenerateQrCodesDependencies } from "@/features/qr-codes/services/generate-qr-codes";
import { AuthError } from "@/features/auth/types/auth";

vi.mock("server-only", () => ({}));

function dependencies(overrides: Partial<GenerateQrCodesDependencies> = {}) {
  let tokenIndex = 0;
  const created: Array<Record<string, unknown>> = [];
  const deps: GenerateQrCodesDependencies = {
    requireAdmin: vi.fn(async () => ({})),
    getOperationalEventId: vi.fn(async () => "event_1"),
    getAppUrl: () => "http://localhost:3000",
    generateToken: () => `secure-token-${++tokenIndex}`,
    runTransaction: vi.fn(async (callback) => callback({
      findLatestSerial: vi.fn(async () => "LB-000010"),
      createMany: vi.fn(async (data) => { created.push(...data); }),
    })),
    ...overrides,
  };
  return { deps, created };
}

describe("generateQrCodes", () => {
  it("generates QR cards for a valid quantity", async () => {
    const { deps } = dependencies();
    await expect(generateQrCodes({ quantity: 2 }, deps)).resolves.toMatchObject({ ok: true, count: 2 });
  });
  it("rejects quantities below the minimum", async () => {
    await expect(generateQrCodes({ quantity: 0 }, dependencies().deps)).resolves.toMatchObject({ ok: false, code: "INVALID_INPUT" });
  });
  it("rejects quantities above the maximum", async () => {
    await expect(generateQrCodes({ quantity: 501 }, dependencies().deps)).resolves.toMatchObject({ ok: false, code: "INVALID_INPUT" });
  });
  it("rejects STAFF authorization", async () => {
    const { deps } = dependencies({ requireAdmin: vi.fn(async () => { throw new AuthError("FORBIDDEN"); }) });
    await expect(generateQrCodes({ quantity: 1 }, deps)).resolves.toMatchObject({ ok: false, code: "UNAUTHORIZED" });
  });
  it("generates unique token hashes", async () => {
    const { deps, created } = dependencies();
    await generateQrCodes({ quantity: 3 }, deps);
    expect(new Set(created.map((row) => row.tokenHash)).size).toBe(3);
  });
  it("stores SHA-256 compatible hashes", async () => {
    const { deps, created } = dependencies({ generateToken: () => "known-token" });
    await generateQrCodes({ quantity: 1 }, deps);
    expect(created[0].tokenHash).toBe(hashQrToken("known-token"));
  });
  it("does not write plain tokens to Prisma data", async () => {
    const { deps, created } = dependencies();
    await generateQrCodes({ quantity: 1 }, deps);
    expect(created[0]).not.toHaveProperty("token");
    expect(JSON.stringify(created)).not.toContain("secure-token");
  });
  it("creates cards in CREATED status with empty timestamps", async () => {
    const { deps, created } = dependencies();
    await generateQrCodes({ quantity: 1 }, deps);
    expect(created[0]).toMatchObject({ status: QrCodeStatus.CREATED, assignedAt: null, usedAt: null });
  });
  it("continues serial numbers in order", async () => {
    const result = await generateQrCodes({ quantity: 3 }, dependencies().deps);
    expect(result).toMatchObject({ ok: true, firstSerialNumber: "LB-000011", lastSerialNumber: "LB-000013" });
  });
  it("continues after the latest serial even when it represents archived history", async () => {
    const { deps } = dependencies({ runTransaction: vi.fn(async (callback) => callback({ findLatestSerial: vi.fn(async () => "LB-000099"), createMany: vi.fn(async () => undefined) })) });
    await expect(generateQrCodes({ quantity: 1 }, deps)).resolves.toMatchObject({ ok: true, firstSerialNumber: "LB-000100" });
  });
  it("maps create failures to CREATE_FAILED", async () => {
    const { deps } = dependencies({ runTransaction: vi.fn(async () => { throw new Error("raw database error"); }) });
    await expect(generateQrCodes({ quantity: 1 }, deps)).resolves.toEqual({ ok: false, code: "CREATE_FAILED", message: "QR kartları oluşturulamadı. Lütfen tekrar deneyin." });
  });
  it("maps exhausted unique conflicts to SERIAL_CONFLICT", async () => {
    const conflict = new Prisma.PrismaClientKnownRequestError("conflict", { code: "P2002", clientVersion: "7.8.0" });
    const runTransaction = vi.fn(async () => { throw conflict; });
    const { deps } = dependencies({ runTransaction });
    await expect(generateQrCodes({ quantity: 1 }, deps)).resolves.toMatchObject({ ok: false, code: "SERIAL_CONFLICT" });
    expect(runTransaction).toHaveBeenCalledTimes(3);
  });
  it("creates CSV with serial numbers and registration URLs", async () => {
    const result = await generateQrCodes({ quantity: 1 }, dependencies().deps);
    expect(result.ok && result.csv).toContain('"LB-000011","http://localhost:3000/r/secure-token-1"');
  });
  it("does not include token hashes in CSV", async () => {
    const result = await generateQrCodes({ quantity: 1 }, dependencies().deps);
    expect(result.ok && result.csv).not.toContain(hashQrToken("secure-token-1"));
  });
  it("does not leak raw failures or tokens in error messages", async () => {
    const { deps } = dependencies({ runTransaction: vi.fn(async () => { throw new Error("secure-token-1 raw database error"); }) });
    const result = await generateQrCodes({ quantity: 1 }, deps);
    expect(JSON.stringify(result)).not.toContain("secure-token-1");
    expect(JSON.stringify(result)).not.toContain("raw database error");
  });
});
