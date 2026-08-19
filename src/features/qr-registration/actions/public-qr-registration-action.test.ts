import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ guard: vi.fn(), create: vi.fn() }));
vi.mock("@/lib/security/public-qr-guard", () => ({ guardPublicQrMutation: mocks.guard }));
vi.mock("@/features/qr-registration/services/create-qr-registration", () => ({ createQrRegistration: mocks.create }));
import { publicQrRegistrationAction } from "./public-qr-registration-action";

function form() { const data = new FormData(); data.set("token", "qr-token"); data.set("cf-turnstile-response", "challenge-token"); data.set("firstName", "Ada"); data.set("lastName", "Lovelace"); data.set("guardianName", "Veli"); data.set("phone", "555"); data.set("schoolId", "school"); return data; }

describe("public QR registration security integration", () => {
  beforeEach(() => vi.clearAllMocks());
  it("does not allow Turnstile or rate-limit guard bypass", async () => {
    mocks.guard.mockResolvedValue({ allowed: false, reason: "TURNSTILE" });
    await expect(publicQrRegistrationAction({ status: "idle", message: null }, form())).resolves.toMatchObject({ status: "error" });
    expect(mocks.guard).toHaveBeenCalledWith("challenge-token");
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("preserves form values without returning QR or challenge tokens after rejection", async () => {
    mocks.guard.mockResolvedValue({ allowed: false, reason: "TURNSTILE" });
    const result = await publicQrRegistrationAction({ status: "idle", message: null }, form());
    expect(result.values).toEqual({ firstName: "Ada", lastName: "Lovelace", guardianName: "Veli", phone: "555", schoolId: "school" });
    expect(JSON.stringify(result)).not.toMatch(/qr-token|challenge-token/);
  });
  it("preserves the existing QR service boundary after controls pass", async () => {
    mocks.guard.mockResolvedValue({ allowed: true }); mocks.create.mockResolvedValue({ ok: true });
    await expect(publicQrRegistrationAction({ status: "idle", message: null }, form())).resolves.toMatchObject({ status: "success" });
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ token: "qr-token", schoolId: "school" }));
  });
});
