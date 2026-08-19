import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ captureException: vi.fn(), setTag: vi.fn(), setContext: vi.fn(), throwFromSdk: false }));
vi.mock("@sentry/nextjs", () => ({
  withScope: (callback: (scope: { setTag: typeof mocks.setTag; setContext: typeof mocks.setContext }) => void) => {
    if (mocks.throwFromSdk) throw new Error("Sentry unavailable");
    callback({ setTag: mocks.setTag, setContext: mocks.setContext });
  },
  captureException: mocks.captureException,
}));
import { captureTechnicalException } from "./capture";

describe("technical error capture", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.throwFromSdk = false; });
  it("captures Academy failures with operational metadata but no student payload", () => {
    captureTechnicalException(new Error("timeout"), { feature: "academy-commission-sync", operation: "run", source: "CRON", syncRunId: "run-1", candidateCount: 4, errorCount: 1 });
    expect(mocks.captureException).toHaveBeenCalledOnce();
    expect(mocks.setTag).toHaveBeenCalledWith("feature", "academy-commission-sync");
    expect(JSON.stringify(mocks.setContext.mock.calls)).not.toMatch(/student|authorization|secret|email|phone/i);
  });
  it("does not break the business flow when the monitoring SDK is unavailable", () => {
    mocks.throwFromSdk = true;
    expect(() => captureTechnicalException(new Error("failure"), { feature: "academy-commission-sync", operation: "run" })).not.toThrow();
  });
});
