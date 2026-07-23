import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique, requireSelectedEvent, requireStaffOrAdmin, transaction, updateMany } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  requireSelectedEvent: vi.fn(),
  requireStaffOrAdmin: vi.fn(),
  transaction: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/features/auth/server/auth", () => ({ requireStaffOrAdmin }));
vi.mock("@/features/events/server/event-context", () => ({ requireSelectedEvent }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: transaction } }));

import { scanAttendance } from "@/features/attendance/services/scan-attendance";

describe("scanner compatibility event", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireStaffOrAdmin.mockResolvedValue({ id: "user_1" });
    requireSelectedEvent.mockResolvedValue({
      id: "leadbridge-legacy-event",
      status: "COMPLETED",
    });
    findUnique.mockResolvedValue({
      id: "qr_1",
      eventId: "leadbridge-legacy-event",
      status: "USED",
      archivedAt: null,
      qrRegistration: {
        id: "registration_1",
        eventId: "leadbridge-legacy-event",
        firstName: "Ayşe",
        lastName: "Yılmaz",
        attendedEvent: false,
      },
    });
    updateMany.mockResolvedValue({ count: 1 });
    transaction.mockImplementation(async (callback) => callback({
      qrCode: { findUnique },
      qrRegistration: { updateMany },
    }));
  });

  it("marks attendance without an event cookie on the completed legacy event", async () => {
    await expect(scanAttendance("leadbridge-scanner-token")).resolves.toEqual({
      ok: true,
      studentName: "Ayşe Yılmaz",
    });
    expect(requireSelectedEvent).toHaveBeenCalledWith({ operational: true });
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ eventId: "leadbridge-legacy-event" }),
    }));
  });
});
