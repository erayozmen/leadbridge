import { QrCodeStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { listVrRecordFilterOptions, listVrRecords, VR_RECORDS_PAGE_SIZE, type ListVrRecordsDependencies, type VrRecordFilterOptionsDependencies } from "@/features/vr-records/queries/list-vr-records";

vi.mock("server-only", () => ({}));
const dependencies = (): ListVrRecordsDependencies => ({ count: vi.fn(async () => 45), findMany: vi.fn(async () => []) });

describe("listVrRecordFilterOptions", () => {
  it("returns only non-empty distinct school rows from the query result", async () => {
    const deps: VrRecordFilterOptionsDependencies = { findSchools: vi.fn(async () => [{ id: "s1", name: "Atatürk" }, { id: "s2", name: "Ziya Gökalp" }]), findCreators: vi.fn(async () => []) };
    await expect(listVrRecordFilterOptions(deps)).resolves.toMatchObject({ schools: [{ id: "s1", name: "Atatürk" }, { id: "s2", name: "Ziya Gökalp" }] });
  });
  it("preserves the alphabetical school order supplied by the database query", async () => {
    const deps: VrRecordFilterOptionsDependencies = { findSchools: vi.fn(async () => [{ id: "a", name: "A Lisesi" }, { id: "b", name: "B Lisesi" }]), findCreators: vi.fn(async () => []) };
    expect((await listVrRecordFilterOptions(deps)).schools.map(({ name }) => name)).toEqual(["A Lisesi", "B Lisesi"]);
  });
  it("returns only creator id and name values", async () => {
    const deps: VrRecordFilterOptionsDependencies = { findSchools: vi.fn(async () => []), findCreators: vi.fn(async () => [{ createdByUser: { id: "u1", fullName: "Ada Yılmaz" } }]) };
    await expect(listVrRecordFilterOptions(deps)).resolves.toMatchObject({ creators: [{ id: "u1", fullName: "Ada Yılmaz" }] });
  });
});

describe("listVrRecords", () => {
  it("applies first name filter", async () => { const deps = dependencies(); await listVrRecords({ firstName: " Ayşe " }, deps); expect(deps.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { firstName: { contains: "Ayşe", mode: "insensitive" } } })); });
  it("applies last name filter", async () => { const deps = dependencies(); await listVrRecords({ lastName: "Yılmaz" }, deps); expect(deps.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { lastName: { contains: "Yılmaz", mode: "insensitive" } } })); });
  it("applies schoolId filter", async () => { const deps = dependencies(); await listVrRecords({ schoolId: "school_1" }, deps); expect(deps.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { schoolId: "school_1" } })); });
  it("includes the start date", async () => { const deps = dependencies(); await listVrRecords({ createdFrom: "2026-07-01" }, deps); expect(deps.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { createdAt: { gte: new Date("2026-07-01T00:00:00.000Z") } } })); });
  it("includes the full end date", async () => { const deps = dependencies(); await listVrRecords({ createdTo: "2026-07-19" }, deps); expect(deps.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { createdAt: { lte: new Date("2026-07-19T23:59:59.999Z") } } })); });
  it("ignores invalid dates", async () => { const deps = dependencies(); await listVrRecords({ createdFrom: "invalid" }, deps); expect(deps.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} })); });
  it("filters by creator", async () => { const deps = dependencies(); await listVrRecords({ createdByUserId: "user_1" }, deps); expect(deps.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { createdByUserId: "user_1" } })); });
  it("filters unassigned QR records", async () => { const deps = dependencies(); await listVrRecords({ qrStatus: "UNASSIGNED" }, deps); expect(deps.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { assignedQrCodeId: null } })); });
  it("filters by QR relation status", async () => { const deps = dependencies(); await listVrRecords({ qrStatus: QrCodeStatus.ASSIGNED }, deps); expect(deps.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { assignedQrCode: { is: { status: QrCodeStatus.ASSIGNED } } } })); });
  it("filters matched records", async () => { const deps = dependencies(); await listVrRecords({ matchStatus: "matched" }, deps); expect(deps.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { studentMatch: { isNot: null } } })); });
  it("filters unmatched records", async () => { const deps = dependencies(); await listVrRecords({ matchStatus: "unmatched" }, deps); expect(deps.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { studentMatch: { is: null } } })); });
  it("combines all filters", async () => { const deps = dependencies(); await listVrRecords({ firstName: "Ada", lastName: "Yılmaz", schoolId: "s1", createdFrom: "2026-07-01", createdTo: "2026-07-19", createdByUserId: "u1", qrStatus: "USED", matchStatus: "matched" }, deps); expect(deps.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ firstName: expect.any(Object), lastName: expect.any(Object), schoolId: "s1", createdAt: expect.any(Object), createdByUserId: "u1", assignedQrCode: { is: { status: "USED" } }, studentMatch: { isNot: null } }) })); });
  it("preserves pagination", async () => { const deps = dependencies(); const result = await listVrRecords({ page: 3 }, deps); expect(deps.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 40, take: VR_RECORDS_PAGE_SIZE })); expect(result).toMatchObject({ page: 3, pageCount: 3, total: 45 }); });
  it("selects no token or tokenHash fields", async () => { const deps = dependencies(); await listVrRecords({}, deps); const call = vi.mocked(deps.findMany).mock.calls[0][0]; expect(JSON.stringify(call.select)).not.toMatch(/token(Hash)?/); });
});
