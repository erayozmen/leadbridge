import { beforeEach, describe, expect, it, vi } from "vitest";

const { findMany, findUnique, requireActiveUser } = vi.hoisted(() => ({
  findMany: vi.fn(),
  findUnique: vi.fn(),
  requireActiveUser: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/features/auth/server/auth", () => ({ requireActiveUser }));
vi.mock("@/lib/prisma", () => ({
  prisma: { event: { findMany, findUnique } },
}));

import {
  EventContextError,
  requireSelectedEvent,
  resolveCompatibilityEvent,
} from "@/features/events/server/event-context";

const event = (id: string, status: "ACTIVE" | "COMPLETED") => ({
  id,
  name: id === "leadbridge-legacy-event" ? "Geçmiş Kayıtlar" : "Aktif Etkinlik",
  eventDate: new Date("2026-07-23T00:00:00.000Z"),
  location: "Sistem",
  status,
});

describe("single-event compatibility resolver", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireActiveUser.mockResolvedValue({ id: "user_1" });
  });

  it("uses the only ACTIVE event without a cookie", async () => {
    findMany.mockResolvedValue([event("active_1", "ACTIVE")]);
    await expect(requireSelectedEvent({ operational: true })).resolves.toMatchObject({ id: "active_1" });
    expect(requireActiveUser).toHaveBeenCalledOnce();
  });

  it("falls back to the completed legacy event", async () => {
    findMany.mockResolvedValue([]);
    findUnique.mockResolvedValue(event("leadbridge-legacy-event", "COMPLETED"));
    await expect(requireSelectedEvent({ operational: true })).resolves.toMatchObject({
      id: "leadbridge-legacy-event",
      status: "COMPLETED",
    });
  });

  it("rejects ambiguous ACTIVE events deterministically", async () => {
    findMany.mockResolvedValue([
      event("active_1", "ACTIVE"),
      event("active_2", "ACTIVE"),
    ]);
    await expect(resolveCompatibilityEvent()).rejects.toEqual(
      new EventContextError("MULTIPLE_ACTIVE_EVENTS"),
    );
    expect(findUnique).not.toHaveBeenCalled();
  });
});
