import { UserRole, UserStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { createVrRecord, type CreateVrRecordDependencies } from "@/features/vr-records/services/create-vr-record";
import { AuthError, type AppUser } from "@/features/auth/types/auth";

vi.mock("server-only", () => ({}));

const admin: AppUser = {
  id: "app_user_1",
  authUserId: "auth_user_1",
  email: "admin@example.test",
  fullName: "Admin User",
  role: UserRole.ADMIN,
  status: UserStatus.ACTIVE,
};

const validInput = {
  firstName: "  Ayşe  ",
  lastName: "  Yılmaz  ",
  schoolId: "school_1",
  phone: "  0532 123 45 67  ",
};

function createDependencies(user: AppUser = admin): CreateVrRecordDependencies {
  return {
    requireUser: vi.fn(async () => user),
    getOperationalEventId: vi.fn(async () => "event_1"),
    findActiveSchool: vi.fn(async () => ({ id: "school_1", name: "Atatürk Lisesi" })),
    createRecord: vi.fn(async (data) => ({
      id: "vr_1",
      firstName: data.firstName,
      lastName: data.lastName,
      school: data.school,
      phone: data.phone,
      createdAt: new Date("2026-07-19T10:00:00.000Z"),
    })),
  };
}

describe("createVrRecord", () => {
  it("creates a record with valid input", async () => {
    const result = await createVrRecord(validInput, createDependencies());

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.record.firstName).toBe("Ayşe");
  });

  it("uses the authenticated app user id", async () => {
    const deps = createDependencies();

    await createVrRecord({ ...validInput, createdByUserId: "client_user" } as typeof validInput, deps);

    expect(deps.createRecord).toHaveBeenCalledWith(expect.objectContaining({
      createdByUserId: admin.id,
      eventId: "event_1",
    }));
  });

  it("uses a validated requested event when one is selected", async () => {
    const deps = createDependencies();
    await createVrRecord({ ...validInput, eventId: "event_2" }, deps);
    expect(deps.getOperationalEventId).toHaveBeenCalledWith("event_2");
  });

  it("rejects invalid input before auth and database calls", async () => {
    const deps = createDependencies();
    const result = await createVrRecord({ ...validInput, firstName: "" }, deps);

    expect(result).toMatchObject({ ok: false, code: "INVALID_INPUT" });
    expect(deps.requireUser).not.toHaveBeenCalled();
    expect(deps.createRecord).not.toHaveBeenCalled();
  });

  it("normalizes an empty optional phone to null", async () => {
    const deps = createDependencies();

    await createVrRecord({ ...validInput, phone: "   " }, deps);

    expect(deps.createRecord).toHaveBeenCalledWith(expect.objectContaining({ phone: null }));
  });

  it("rejects an inactive or missing school", async () => {
    const deps = createDependencies(); deps.findActiveSchool = vi.fn(async () => null);
    await expect(createVrRecord(validInput, deps)).resolves.toMatchObject({ ok: false, code: "INVALID_INPUT" });
    expect(deps.createRecord).not.toHaveBeenCalled();
  });

  it("writes schoolId and the server-selected legacy school name", async () => {
    const deps = createDependencies();
    await createVrRecord({ ...validInput, school: "Fake School" } as typeof validInput, deps);
    expect(deps.createRecord).toHaveBeenCalledWith(expect.objectContaining({ schoolId: "school_1", school: "Atatürk Lisesi" }));
  });

  it("allows ADMIN to create a record", async () => {
    await expect(createVrRecord(validInput, createDependencies(admin))).resolves.toMatchObject({ ok: true });
  });

  it("allows STAFF to create a record", async () => {
    const staff = { ...admin, role: UserRole.STAFF };

    await expect(createVrRecord(validInput, createDependencies(staff))).resolves.toMatchObject({ ok: true });
  });

  it("maps authorization failures to a safe result", async () => {
    const deps = createDependencies();
    deps.requireUser = vi.fn(async () => {
      throw new AuthError("UNAUTHENTICATED");
    });

    await expect(createVrRecord(validInput, deps)).resolves.toMatchObject({ ok: false, code: "UNAUTHORIZED" });
    expect(deps.createRecord).not.toHaveBeenCalled();
  });

  it("maps Prisma create errors to CREATE_FAILED", async () => {
    const deps = createDependencies();
    deps.createRecord = vi.fn(async () => {
      throw new Error("database details");
    });

    const result = await createVrRecord(validInput, deps);

    expect(result).toEqual({ ok: false, code: "CREATE_FAILED", message: "VR kaydı oluşturulamadı. Lütfen tekrar deneyin." });
  });
});
