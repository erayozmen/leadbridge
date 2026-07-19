import { describe, expect, it, vi } from "vitest";

import { disableQrCode, type DisableQrCodeDependencies } from "@/features/qr-codes/services/disable-qr-code";

vi.mock("server-only", () => ({}));

function dependencies(count: number): DisableQrCodeDependencies {
  return { requireAdmin: vi.fn(async () => ({})), disableCreated: vi.fn(async () => count) };
}

describe("disableQrCode", () => {
  it("disables a CREATED QR when the atomic update succeeds", async () => {
    await expect(disableQrCode("qr_1", dependencies(1))).resolves.toMatchObject({ ok: true });
  });
  it.each(["ASSIGNED", "USED", "DISABLED"])("does not disable a %s QR", async () => {
    await expect(disableQrCode("qr_1", dependencies(0))).resolves.toMatchObject({ ok: false, code: "NOT_ALLOWED" });
  });
});
