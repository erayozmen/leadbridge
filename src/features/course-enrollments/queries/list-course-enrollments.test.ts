import { describe, expect, it, vi } from "vitest";
import { COURSE_ENROLLMENTS_PAGE_SIZE, listCourseEnrollments, type ListCourseEnrollmentDependencies } from "@/features/course-enrollments/queries/list-course-enrollments";
vi.mock("server-only", () => ({}));
const deps = (): ListCourseEnrollmentDependencies => ({ count: vi.fn(async () => 41), findMany: vi.fn(async () => []) });
describe("listCourseEnrollments", () => {
  it("applies all filters together", async () => { const state = deps(); await listCourseEnrollments({ firstName: "Ada", lastName: "Yılmaz", schoolId: "s1", phone: "0532", attendance: "attended", enrollment: "not-enrolled", registeredFrom: "2026-07-01", registeredTo: "2026-07-19" }, state); expect(vi.mocked(state.findMany).mock.calls[0][0].where).toEqual(expect.objectContaining({ firstName: expect.anything(), lastName: expect.anything(), schoolId: "s1", phone: expect.anything(), attendedEvent: true, enrolledCourse: false, registeredAt: { gte: new Date("2026-07-01T00:00:00.000Z"), lte: new Date("2026-07-19T23:59:59.999Z") } })); });
  it("paginates by selected page size", async () => { const state = deps(); await listCourseEnrollments({ page: 3 }, state); expect(state.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 50, take: COURSE_ENROLLMENTS_PAGE_SIZE })); });
  it("selects enrollment audit fields", async () => { const state = deps(); await listCourseEnrollments({}, state); expect(vi.mocked(state.findMany).mock.calls[0][0].select).toMatchObject({ enrolledCourse: true, enrolledAt: true, enrolledByUser: { select: { fullName: true } } }); });
  it("does not select token or tokenHash", async () => { const state = deps(); await listCourseEnrollments({}, state); expect(JSON.stringify(vi.mocked(state.findMany).mock.calls[0][0].select)).not.toMatch(/token(Hash)?/); });
});
