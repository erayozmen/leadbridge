import { Prisma, QrCodeStatus, SchoolStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { hashQrToken } from "@/features/qr-registration/lib/hash-qr-token";
import { createQrRegistration } from "@/features/qr-registration/services/create-qr-registration";

vi.mock("server-only", () => ({}));

const validInput = {
  token: "leadbridge-valid-token",
  firstName: " Ayşe ",
  lastName: " Yılmaz ",
  guardianName: " Fatma Yılmaz ",
  phone: " 0532 123 45 67 ",
  schoolId: "school_1",
};

type Options = {
  status?: QrCodeStatus;
  found?: boolean;
  linked?: boolean;
  existingRegistration?: boolean;
  updateCount?: number;
  createError?: unknown;
  schoolFound?: boolean;
  schoolStatus?: SchoolStatus;
  archived?: boolean;
};

function createMockPrisma(options: Options = {}) {
  const status = options.status ?? QrCodeStatus.ASSIGNED;
  const state = { status, usedAt: null as Date | null, registration: null as null | { id: string; qrCodeId: string } };
  const findUnique = vi.fn(async () =>
    options.found === false
      ? null
      : {
          id: "qr_1",
          status: state.status,
          archivedAt: options.archived ? new Date() : null,
          qrRegistration: options.existingRegistration ? { id: "registration_old" } : null,
          assignedVrRecord: options.linked === false ? null : { id: "vr_1" },
        },
  );
  const updateMany = vi.fn(async ({ data }: { data: { status: QrCodeStatus; usedAt: Date } }) => {
    const count = options.updateCount ?? 1;
    if (count === 1) {
      state.status = data.status;
      state.usedAt = data.usedAt;
    }
    return { count };
  });
  const create = vi.fn(async ({ data }: { data: { qrCodeId: string } }) => {
    if (options.createError) throw options.createError;
    state.registration = { id: "registration_1", qrCodeId: data.qrCodeId };
    return { id: "registration_1", ...data, registeredAt: new Date() };
  });
  const findSchool = vi.fn(async () => options.schoolFound === false ? null : { id: "school_1", name: "Atatürk İlkokulu", status: options.schoolStatus ?? SchoolStatus.ACTIVE });
  const transaction = vi.fn(async <T>(callback: (tx: {
    qrCode: { findUnique: typeof findUnique; updateMany: typeof updateMany };
    qrRegistration: { create: typeof create };
    school: { findUnique: typeof findSchool };
  }) => Promise<T>) => {
    const snapshot = { ...state };
    try {
      return await callback({ qrCode: { findUnique, updateMany }, qrRegistration: { create }, school: { findUnique: findSchool } });
    } catch (error) {
      state.status = snapshot.status;
      state.usedAt = snapshot.usedAt;
      state.registration = snapshot.registration;
      throw error;
    }
  });
  return { prisma: { $transaction: transaction }, state, calls: { findUnique, updateMany, create, findSchool, transaction } };
}

describe("createQrRegistration", () => {
  it("creates a registration for an ASSIGNED QR linked to a VR record", async () => {
    const mock = createMockPrisma();
    const result = await createQrRegistration(validInput, mock.prisma);
    expect(result.ok).toBe(true);
    expect(mock.state.registration).toMatchObject({ qrCodeId: "qr_1" });
    expect(mock.state.status).toBe(QrCodeStatus.USED);
    expect(mock.state.usedAt).toBeInstanceOf(Date);
    expect(mock.calls.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { tokenHash: hashQrToken(validInput.token) } }));
  });
  it("rejects a CREATED QR", async () => {
    await expect(createQrRegistration(validInput, createMockPrisma({ status: QrCodeStatus.CREATED }).prisma)).resolves.toMatchObject({ ok: false, code: "QR_NOT_ASSIGNED" });
  });
  it("rejects an ASSIGNED QR without a linked VR record", async () => {
    await expect(createQrRegistration(validInput, createMockPrisma({ linked: false }).prisma)).resolves.toMatchObject({ ok: false, code: "QR_NOT_ASSIGNED" });
  });
  it.each([[QrCodeStatus.USED, "QR_ALREADY_USED"], [QrCodeStatus.DISABLED, "QR_DISABLED"]] as const)("rejects %s", async (status, code) => {
    await expect(createQrRegistration(validInput, createMockPrisma({ status }).prisma)).resolves.toMatchObject({ ok: false, code });
  });
  it("rejects an archived QR without changing status", async () => {
    const mock = createMockPrisma({ archived: true });
    await expect(createQrRegistration(validInput, mock.prisma)).resolves.toMatchObject({
      ok: false,
      code: "QR_DISABLED",
    });
    expect(mock.calls.updateMany).not.toHaveBeenCalled();
    expect(mock.state.status).toBe(QrCodeStatus.ASSIGNED);
  });
  it("rejects an unknown token", async () => {
    await expect(createQrRegistration(validInput, createMockPrisma({ found: false }).prisma)).resolves.toMatchObject({ ok: false, code: "QR_NOT_FOUND" });
  });
  it("rejects invalid form data before Prisma", async () => {
    const mock = createMockPrisma();
    await expect(createQrRegistration({ ...validInput, firstName: "" }, mock.prisma)).resolves.toMatchObject({ ok: false, code: "INVALID_INPUT" });
    expect(mock.calls.transaction).not.toHaveBeenCalled();
  });
  it("rejects a second registration", async () => {
    await expect(createQrRegistration(validInput, createMockPrisma({ existingRegistration: true }).prisma)).resolves.toMatchObject({ ok: false, code: "QR_REGISTRATION_CONFLICT" });
  });
  it("rejects a missing school without using the QR", async () => {
    const mock = createMockPrisma({ schoolFound: false });
    await expect(createQrRegistration(validInput, mock.prisma)).resolves.toMatchObject({ ok: false, code: "SCHOOL_NOT_FOUND" });
    expect(mock.state.status).toBe(QrCodeStatus.ASSIGNED); expect(mock.calls.updateMany).not.toHaveBeenCalled();
  });
  it("rejects an inactive school without using the QR", async () => {
    const mock = createMockPrisma({ schoolStatus: SchoolStatus.INACTIVE });
    await expect(createQrRegistration(validInput, mock.prisma)).resolves.toMatchObject({ ok: false, code: "SCHOOL_INACTIVE" });
    expect(mock.state.status).toBe(QrCodeStatus.ASSIGNED); expect(mock.calls.create).not.toHaveBeenCalled();
  });
  it("writes schoolId and the server-selected legacy name", async () => {
    const mock = createMockPrisma(); await createQrRegistration({ ...validInput, school: "Fake" } as typeof validInput, mock.prisma);
    expect(mock.calls.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ schoolId: "school_1", school: "Atatürk İlkokulu" }) }));
  });
  it("requires schoolId before opening a transaction", async () => {
    const mock = createMockPrisma(); await expect(createQrRegistration({ ...validInput, schoolId: "" }, mock.prisma)).resolves.toMatchObject({ ok: false, code: "INVALID_INPUT" }); expect(mock.calls.transaction).not.toHaveBeenCalled();
  });
  it("maps P2002 to a safe conflict", async () => {
    const error = new Prisma.PrismaClientKnownRequestError("raw", { code: "P2002", clientVersion: "7.8.0" });
    const result = await createQrRegistration(validInput, createMockPrisma({ createError: error }).prisma);
    expect(result).toMatchObject({ ok: false, code: "QR_REGISTRATION_CONFLICT" });
    expect(JSON.stringify(result)).not.toContain(validInput.token);
  });
  it("rolls back QR status when registration creation fails", async () => {
    const mock = createMockPrisma({ createError: new Error("database detail") });
    const result = await createQrRegistration(validInput, mock.prisma);
    expect(result).toMatchObject({ ok: false, code: "INTERNAL_ERROR" });
    expect(mock.state.status).toBe(QrCodeStatus.ASSIGNED);
    expect(mock.state.registration).toBeNull();
    expect(JSON.stringify(result)).not.toContain("database detail");
  });
  it("treats conditional update count zero as a conflict", async () => {
    const mock = createMockPrisma({ updateCount: 0 });
    await expect(createQrRegistration(validInput, mock.prisma)).resolves.toMatchObject({ ok: false, code: "QR_REGISTRATION_CONFLICT" });
    expect(mock.calls.create).not.toHaveBeenCalled();
  });
});
