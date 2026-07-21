import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  generateQrCodes: vi.fn(),
  disableQrCode: vi.fn(),
  archiveQrCode: vi.fn(),
  archiveAllDisabledQrCodes: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/features/auth/server/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/features/qr-codes/services/generate-qr-codes", () => ({ generateQrCodes: mocks.generateQrCodes }));
vi.mock("@/features/qr-codes/services/disable-qr-code", () => ({ disableQrCode: mocks.disableQrCode }));
vi.mock("@/features/qr-codes/services/archive-qr-codes", () => ({
  archiveQrCode: mocks.archiveQrCode,
  archiveAllDisabledQrCodes: mocks.archiveAllDisabledQrCodes,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import {
  archiveAllDisabledQrCodesAction,
  archiveQrCodeAction,
  disableQrCodeAction,
  generateQrCodesAction,
} from "@/features/qr-codes/actions/qr-code-actions";

const initial = { status: "idle" as const, message: null };

describe("QR management action authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockRejectedValue(new Error("forbidden"));
  });

  it("rejects STAFF from every mutation before service access", async () => {
    const results = await Promise.all([
      generateQrCodesAction(initial, new FormData()),
      disableQrCodeAction(initial, new FormData()),
      archiveQrCodeAction(initial, new FormData()),
      archiveAllDisabledQrCodesAction(initial),
    ]);
    expect(results.every((result) => result.status === "error")).toBe(true);
    expect(mocks.generateQrCodes).not.toHaveBeenCalled();
    expect(mocks.disableQrCode).not.toHaveBeenCalled();
    expect(mocks.archiveQrCode).not.toHaveBeenCalled();
    expect(mocks.archiveAllDisabledQrCodes).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
