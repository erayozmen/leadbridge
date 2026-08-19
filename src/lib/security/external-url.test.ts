import { describe, expect, it } from "vitest";
import { validateServerIntegrationBaseUrl } from "./external-url";

describe("server integration URL validation", () => {
  it("accepts a production HTTPS origin", () => expect(validateServerIntegrationBaseUrl("https://academy.example.com", true).origin).toBe("https://academy.example.com"));
  it("rejects production HTTP and private hosts", () => {
    expect(() => validateServerIntegrationBaseUrl("http://academy.example.com", true)).toThrow("HTTPS");
    expect(() => validateServerIntegrationBaseUrl("https://127.0.0.1", true)).toThrow("not allowed");
  });
  it("rejects embedded credentials", () => expect(() => validateServerIntegrationBaseUrl("https://user:pass@academy.example.com", true)).toThrow("invalid"));
  it("allows localhost HTTP only outside production", () => expect(validateServerIntegrationBaseUrl("http://localhost:3001", false).port).toBe("3001"));
});
