import { UserRole } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  canMarkAttendance,
  canReverseAttendance,
} from "@/features/attendance/lib/attendance-permissions";

describe("attendance action visibility", () => {
  it("does not produce a mark action for attended records", () => {
    expect(canMarkAttendance(true)).toBe(false);
    expect(canMarkAttendance(false)).toBe(true);
  });

  it("allows only ADMIN to reverse attended records", () => {
    expect(canReverseAttendance(UserRole.ADMIN, true)).toBe(true);
    expect(canReverseAttendance(UserRole.STAFF, true)).toBe(false);
    expect(canReverseAttendance(UserRole.ADMIN, false)).toBe(false);
  });
});
