import { QrCodeStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { canUnassignQrCode } from "@/features/vr-records/lib/qr-unassignment-permissions";

const eligible = {
  role: "ADMIN" as const,
  status: QrCodeStatus.ASSIGNED,
  usedAt: null,
  archivedAt: null,
  hasRegistration: false,
  hasStudentMatch: false,
};

describe("QR unassignment visibility", () => {
  it("shows the action for eligible ADMIN records", () => expect(canUnassignQrCode(eligible)).toBe(true));
  it("hides the action from STAFF", () => expect(canUnassignQrCode({ ...eligible, role: "STAFF" })).toBe(false));
  it.each([
    { status: QrCodeStatus.USED },
    { status: QrCodeStatus.DISABLED },
    { usedAt: new Date() },
    { archivedAt: new Date() },
    { hasRegistration: true },
    { hasStudentMatch: true },
  ])("hides the action for unsafe state %#", (override) => {
    expect(canUnassignQrCode({ ...eligible, ...override })).toBe(false);
  });
});
