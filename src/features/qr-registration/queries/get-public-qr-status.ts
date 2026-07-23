import "server-only";

import { EventStatus, QrCodeStatus } from "@prisma/client";

import { isLegacyCompatibilityEvent } from "@/features/events/server/compatibility-event";
import { hashQrToken } from "@/features/qr-registration/lib/hash-qr-token";
import { qrRegistrationSchema } from "@/features/qr-registration/schemas/qr-registration.schema";

export type PublicQrStatus =
  | "AVAILABLE"
  | "NOT_FOUND"
  | "NOT_ASSIGNED"
  | "ALREADY_USED"
  | "DISABLED"
  | "INVALID_TOKEN"
  | "INTERNAL_ERROR";

type PublicQrRecord = {
  eventId?: string;
  status: QrCodeStatus;
  archived: boolean;
  hasAssignedVrRecord: boolean;
  hasRegistration: boolean;
  eventStatus?: EventStatus;
};

export type PublicQrStatusDependencies = {
  findByTokenHash: (tokenHash: string) => Promise<PublicQrRecord | null>;
};

async function getDefaultDependencies(): Promise<PublicQrStatusDependencies> {
  const { prisma } = await import("@/lib/prisma");
  return {
    async findByTokenHash(tokenHash) {
      const qrCode = await prisma.qrCode.findUnique({
        where: { tokenHash },
        select: {
          eventId: true,
          status: true,
          event: { select: { status: true } },
          archivedAt: true,
          assignedVrRecord: { select: { id: true } },
          qrRegistration: { select: { id: true } },
        },
      });
      return qrCode
          ? {
            eventId: qrCode.eventId,
            status: qrCode.status,
            archived: Boolean(qrCode.archivedAt),
            hasAssignedVrRecord: Boolean(qrCode.assignedVrRecord),
            hasRegistration: Boolean(qrCode.qrRegistration),
            eventStatus: qrCode.event.status,
          }
        : null;
    },
  };
}

export async function getPublicQrStatus(
  token: string,
  dependencies?: PublicQrStatusDependencies,
): Promise<PublicQrStatus> {
  const parsedToken = qrRegistrationSchema.shape.token.safeParse(token);
  if (!parsedToken.success) return "INVALID_TOKEN";

  try {
    const resolved = dependencies ?? (await getDefaultDependencies());
    const qrCode = await resolved.findByTokenHash(hashQrToken(parsedToken.data));
    if (!qrCode) return "NOT_FOUND";
    const eventStatus = qrCode.eventStatus ?? EventStatus.ACTIVE;
    if (
      eventStatus !== EventStatus.ACTIVE
      && !(qrCode.eventId && isLegacyCompatibilityEvent(qrCode.eventId, eventStatus))
    ) return "DISABLED";
    if (qrCode.archived || qrCode.status === QrCodeStatus.DISABLED) return "DISABLED";
    if (qrCode.status === QrCodeStatus.USED || qrCode.hasRegistration) return "ALREADY_USED";
    if (qrCode.status !== QrCodeStatus.ASSIGNED || !qrCode.hasAssignedVrRecord) return "NOT_ASSIGNED";
    return "AVAILABLE";
  } catch {
    return "INTERNAL_ERROR";
  }
}
