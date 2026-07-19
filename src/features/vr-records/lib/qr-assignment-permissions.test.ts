import { describe, expect, it } from "vitest";

import { canAssignQrCode } from "@/features/vr-records/lib/qr-assignment-permissions";

describe("QR assignment visibility", () => {
  it("does not expose assignment actions to STAFF", () => {
    expect(canAssignQrCode("STAFF")).toBe(false);
    expect(canAssignQrCode("ADMIN")).toBe(true);
  });
});
