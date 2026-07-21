import { EventStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/features/auth/server/auth", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/features/audit/services/write-audit-log", () => ({
  writeAuditLog: vi.fn(),
}));

import { isEventTransitionAllowed } from "@/features/events/services/event-service";

describe("event status transitions", () => {
  it.each([
    [EventStatus.DRAFT, EventStatus.ACTIVE],
    [EventStatus.ACTIVE, EventStatus.COMPLETED],
    [EventStatus.COMPLETED, EventStatus.ARCHIVED],
  ])("allows %s to %s", (current, next) => {
    expect(isEventTransitionAllowed(current, next)).toBe(true);
  });

  it("rejects backward and archived transitions", () => {
    expect(
      isEventTransitionAllowed(EventStatus.ACTIVE, EventStatus.DRAFT),
    ).toBe(false);
    expect(
      isEventTransitionAllowed(EventStatus.ARCHIVED, EventStatus.ACTIVE),
    ).toBe(false);
  });
});
