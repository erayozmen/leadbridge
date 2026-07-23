import { EventStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireAdmin, writeAuditLog, transaction, tx } = vi.hoisted(() => {
  const tx = { event: { findUnique: vi.fn(), count: vi.fn(), update: vi.fn() }, auditLog: { create: vi.fn() } };
  return {
    requireAdmin: vi.fn(async () => ({ id: "admin_1" })),
    writeAuditLog: vi.fn(async () => ({ id: "audit_1", createdAt: new Date() })),
    transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    tx,
  };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: transaction } }));
vi.mock("@/features/auth/server/auth", () => ({ requireAdmin }));
vi.mock("@/features/audit/services/write-audit-log", () => ({
  writeAuditLog,
}));

import { advanceEventStatus, isEventTransitionAllowed } from "@/features/events/services/event-service";

describe("event status transitions", () => {
  beforeEach(() => vi.clearAllMocks());
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

  it("rejects activating a second event", async () => {
    tx.event.findUnique.mockResolvedValue({ id: "event_2", name: "İkinci", status: EventStatus.DRAFT });
    tx.event.count.mockResolvedValue(1);
    await expect(advanceEventStatus("event_2", EventStatus.ACTIVE, "Etkinlik şimdi başlatılıyor")).rejects.toThrow("ACTIVE_EVENT_EXISTS");
    expect(tx.event.update).not.toHaveBeenCalled();
    expect(writeAuditLog).not.toHaveBeenCalled();
  });

  it("activates the only event and audits the status change", async () => {
    tx.event.findUnique.mockResolvedValue({ id: "event_1", name: "Birinci", status: EventStatus.DRAFT });
    tx.event.count.mockResolvedValue(0);
    tx.event.update.mockResolvedValue({ id: "event_1", name: "Birinci", status: EventStatus.ACTIVE });
    await expect(advanceEventStatus("event_1", EventStatus.ACTIVE, "Etkinlik şimdi başlatılıyor")).resolves.toMatchObject({ status: EventStatus.ACTIVE });
    expect(transaction).toHaveBeenLastCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
    expect(writeAuditLog).toHaveBeenCalledOnce();
  });
});
