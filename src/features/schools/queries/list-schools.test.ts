import { SchoolStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { listActiveSchools, listSchools, SCHOOL_PAGE_SIZE, type ListSchoolsDependencies } from "@/features/schools/queries/list-schools";
vi.mock("server-only", () => ({}));
const deps = (): ListSchoolsDependencies => ({ count: vi.fn(async () => 21), findMany: vi.fn(async () => []) });
describe("listSchools", () => {
  it("filters by status", async () => { const state = deps(); await listSchools({ status: SchoolStatus.ACTIVE }, state); expect(state.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: SchoolStatus.ACTIVE } })); });
  it("selects VR and QR registration counts", async () => { const state = deps(); await listSchools({}, state); const args = vi.mocked(state.findMany).mock.calls[0][0]; expect(args.select).toMatchObject({ _count: { select: { vrRecords: true, qrRegistrations: true } } }); });
  it("paginates with twenty rows", async () => { const state = deps(); await listSchools({ page: 2 }, state); expect(state.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: SCHOOL_PAGE_SIZE })); });
  it("does not select secrets or tokens", async () => { const state = deps(); await listSchools({}, state); expect(JSON.stringify(vi.mocked(state.findMany).mock.calls[0][0].select)).not.toMatch(/token|secret/i); });
});
describe("listActiveSchools", () => {
  it("selects only active schools in alphabetical order", async () => {
    const findMany = vi.fn(async () => []);
    await listActiveSchools({ findMany });
    expect(findMany).toHaveBeenCalledWith({ where: { status: SchoolStatus.ACTIVE }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  });
});
