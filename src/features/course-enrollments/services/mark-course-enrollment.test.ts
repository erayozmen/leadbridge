import { UserRole, UserStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { AuthError, type AppUser } from "@/features/auth/types/auth";
import { markCourseEnrollment, type MarkCourseEnrollmentDependencies } from "@/features/course-enrollments/services/mark-course-enrollment";
vi.mock("server-only", () => ({}));
const admin: AppUser = { id: "admin_1", authUserId: "auth_1", email: "a@test.dev", fullName: "Admin", role: UserRole.ADMIN, status: UserStatus.ACTIVE };
type Options = { found?: boolean; enrolled?: boolean; count?: number; afterEnrolled?: boolean; error?: boolean };
function deps(options: Options = {}) { let call = 0; const state: MarkCourseEnrollmentDependencies = { requireAdmin: vi.fn(async () => admin), findRegistration: vi.fn(async () => { call++; if (options.error) throw new Error("raw database secret"); if (options.found === false) return null; return { id: "reg_1", enrolledCourse: call > 1 ? options.afterEnrolled ?? false : options.enrolled ?? false }; }), updateIfNotEnrolled: vi.fn(async () => options.count ?? 1) }; return state; }
describe("markCourseEnrollment", () => {
  it("allows ADMIN", async () => expect(markCourseEnrollment({ qrRegistrationId: "reg_1" }, deps())).resolves.toMatchObject({ ok: true }));
  it("rejects STAFF authorization", async () => { const state = deps(); state.requireAdmin = vi.fn(async () => { throw new AuthError("FORBIDDEN"); }); await expect(markCourseEnrollment({ qrRegistrationId: "reg_1" }, state)).resolves.toMatchObject({ code: "UNAUTHORIZED" }); });
  it("rejects invalid ids before auth and DB", async () => { const state = deps(); await expect(markCourseEnrollment({ qrRegistrationId: "" }, state)).resolves.toMatchObject({ code: "INVALID_INPUT" }); expect(state.requireAdmin).not.toHaveBeenCalled(); expect(state.findRegistration).not.toHaveBeenCalled(); });
  it("returns REGISTRATION_NOT_FOUND", async () => expect(markCourseEnrollment({ qrRegistrationId: "reg_1" }, deps({ found: false }))).resolves.toMatchObject({ code: "REGISTRATION_NOT_FOUND" }));
  it("returns ALREADY_ENROLLED", async () => { const state = deps({ enrolled: true }); await expect(markCourseEnrollment({ qrRegistrationId: "reg_1" }, state)).resolves.toMatchObject({ code: "ALREADY_ENROLLED" }); expect(state.updateIfNotEnrolled).not.toHaveBeenCalled(); });
  it("writes enrollment fields from server context", async () => { const state = deps(); await markCourseEnrollment({ qrRegistrationId: "reg_1", userId: "fake", enrolledAt: "fake" } as { qrRegistrationId: string }, state); expect(state.updateIfNotEnrolled).toHaveBeenCalledWith("reg_1", { enrolledCourse: true, enrolledAt: expect.any(Date), enrolledByUserId: "admin_1" }); });
  it("does not require event attendance", async () => { const state = deps(); await expect(markCourseEnrollment({ qrRegistrationId: "reg_1", attendedEvent: false } as { qrRegistrationId: string }, state)).resolves.toMatchObject({ ok: true }); });
  it("maps a concurrent success to ALREADY_ENROLLED", async () => expect(markCourseEnrollment({ qrRegistrationId: "reg_1" }, deps({ count: 0, afterEnrolled: true }))).resolves.toMatchObject({ code: "ALREADY_ENROLLED" }));
  it("does not overwrite after concurrent success", async () => { const state = deps({ count: 0, afterEnrolled: true }); await markCourseEnrollment({ qrRegistrationId: "reg_1" }, state); expect(state.updateIfNotEnrolled).toHaveBeenCalledTimes(1); });
  it("returns ENROLLMENT_CONFLICT when unchanged", async () => expect(markCourseEnrollment({ qrRegistrationId: "reg_1" }, deps({ count: 0, afterEnrolled: false }))).resolves.toMatchObject({ code: "ENROLLMENT_CONFLICT" }));
  it("hides Prisma errors", async () => { const result = await markCourseEnrollment({ qrRegistrationId: "reg_1" }, deps({ error: true })); expect(result).toMatchObject({ code: "ENROLLMENT_FAILED" }); expect(JSON.stringify(result)).not.toContain("raw database secret"); });
});
