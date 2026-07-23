import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookies, findFirst, requireActiveUser } = vi.hoisted(() => ({
  cookies: vi.fn(),
  findFirst: vi.fn(),
  requireActiveUser: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies }));
vi.mock("@/features/auth/server/auth", () => ({ requireActiveUser }));
vi.mock("@/lib/prisma", () => ({ prisma: { event: { findFirst } } }));
vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<typeof import("react")>();
  return {
    ...react,
    cache: <T extends (...args: never[]) => unknown>(fn: T) => {
      let result: ReturnType<T> | undefined;
      return ((...args: Parameters<T>) => {
        result ??= fn(...args) as ReturnType<T>;
        return result;
      }) as T;
    },
  };
});

import {
  getSelectedEvent,
  requireSelectedEvent,
} from "@/features/events/server/event-context";

describe("event request context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireActiveUser.mockResolvedValue({ role: "ADMIN" });
    cookies.mockResolvedValue({ get: vi.fn(() => ({ value: "event_1" })) });
    findFirst.mockResolvedValue({
      id: "event_1",
      name: "Etkinlik",
      eventDate: new Date("2026-07-23T00:00:00.000Z"),
      location: "Salon",
      status: "ACTIVE",
    });
  });

  it("reuses the authenticated user and selected event within one request", async () => {
    const first = await getSelectedEvent();
    const second = await requireSelectedEvent({ operational: true });

    expect(first).toEqual(second);
    expect(requireActiveUser).toHaveBeenCalledOnce();
    expect(findFirst).toHaveBeenCalledOnce();
  });
});
