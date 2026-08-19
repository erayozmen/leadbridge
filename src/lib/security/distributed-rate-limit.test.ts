import { describe, expect, it, vi } from "vitest";
import { createUpstashRateLimitStore } from "./distributed-rate-limit";

describe("Upstash distributed rate limit adapter", () => {
  it("uses an atomic transaction and allows counts under both limits", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify([{ result: 1 }, { result: 1 }, { result: 2 }, { result: 1 }]), { status: 200 }));
    const store = createUpstashRateLimitStore({ url: "https://redis.example", token: "credential", fetchImpl });
    await expect(store.consume("hashed-key", [{ name: "burst", limit: 8, windowMs: 60_000 }, { name: "sustained", limit: 30, windowMs: 900_000 }])).resolves.toEqual({ allowed: true, counts: [1, 2] });
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("https://redis.example/multi-exec");
  });
  it("rejects over-limit counts and accepts reset counts from Redis TTL expiry", async () => {
    const responses = [[{ result: 9 }, { result: 0 }], [{ result: 1 }, { result: 1 }]];
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(responses.shift()), { status: 200 }));
    const store = createUpstashRateLimitStore({ url: "https://redis.example", token: "credential", fetchImpl });
    const windows = [{ name: "burst", limit: 8, windowMs: 60_000 }];
    await expect(store.consume("hashed-key", windows)).resolves.toMatchObject({ allowed: false });
    await expect(store.consume("hashed-key", windows)).resolves.toMatchObject({ allowed: true, counts: [1] });
  });
  it("throws on unavailable or malformed stores", async () => {
    const unavailable = createUpstashRateLimitStore({ url: "https://redis.example", token: "credential", fetchImpl: vi.fn(async () => new Response("", { status: 503 })) });
    await expect(unavailable.consume("key", [{ name: "burst", limit: 1, windowMs: 1_000 }])).rejects.toThrow("unavailable");
  });
});
