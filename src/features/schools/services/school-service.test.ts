import { Prisma, SchoolStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { AuthError } from "@/features/auth/types/auth";
import { createSchool, setSchoolStatus, updateSchool } from "@/features/schools/services/school-service";
import type { SchoolMutationDependencies } from "@/features/schools/types/school-result";
vi.mock("server-only", () => ({}));

const deps = (overrides: Partial<SchoolMutationDependencies> = {}): SchoolMutationDependencies => ({ requireAdmin: vi.fn(async () => ({})), create: vi.fn(async () => ({})), update: vi.fn(async () => 1), setStatus: vi.fn(async () => 1), ...overrides });
describe("school services", () => {
  it("allows ADMIN to create a school", async () => expect(createSchool({ name: "A Lisesi" }, deps())).resolves.toMatchObject({ ok: true }));
  it("rejects STAFF", async () => expect(createSchool({ name: "A Lisesi" }, deps({ requireAdmin: vi.fn(async () => { throw new AuthError("FORBIDDEN"); }) }))).resolves.toMatchObject({ ok: false, code: "UNAUTHORIZED" }));
  it("does not accept normalizedName from clients", async () => { const state = deps(); await createSchool({ name: " A   LİSESİ ", normalizedName: "fake" } as { name: string }, state); expect(state.create).toHaveBeenCalledWith({ name: "A LİSESİ", normalizedName: "a lisesi" }); });
  it("maps duplicate create errors", async () => { const error = new Prisma.PrismaClientKnownRequestError("duplicate", { code: "P2002", clientVersion: "7.8.0" }); await expect(createSchool({ name: "A Lisesi" }, deps({ create: vi.fn(async () => { throw error; }) }))).resolves.toMatchObject({ ok: false, code: "SCHOOL_ALREADY_EXISTS" }); });
  it("recalculates normalizedName on update", async () => { const state = deps(); await updateSchool({ id: "s1", name: " İZMİR   LİSESİ " }, state); expect(state.update).toHaveBeenCalledWith("s1", { name: "İZMİR LİSESİ", normalizedName: "izmir lisesi" }); });
  it("can make a school inactive", async () => { const state = deps(); await setSchoolStatus({ id: "s1", status: SchoolStatus.INACTIVE }, state); expect(state.setStatus).toHaveBeenCalledWith("s1", SchoolStatus.INACTIVE); });
  it("does not leak raw errors", async () => { const result = await createSchool({ name: "A Lisesi" }, deps({ create: vi.fn(async () => { throw new Error("raw secret"); }) })); expect(JSON.stringify(result)).not.toContain("raw secret"); });
});
