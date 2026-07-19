import "server-only";

import { QrCodeStatus } from "@prisma/client";

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
  status: QrCodeStatus;
  hasAssignedVrRecord: boolean;
  hasRegistration: boolean;
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
          status: true,
          assignedVrRecord: { select: { id: true } },
          qrRegistration: { select: { id: true } },
        },
      });
      return qrCode
        ? {
            status: qrCode.status,
            hasAssignedVrRecord: Boolean(qrCode.assignedVrRecord),
            hasRegistration: Boolean(qrCode.qrRegistration),
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
    if (qrCode.status === QrCodeStatus.DISABLED) return "DISABLED";
    if (qrCode.status === QrCodeStatus.USED || qrCode.hasRegistration) return "ALREADY_USED";
    if (qrCode.status !== QrCodeStatus.ASSIGNED || !qrCode.hasAssignedVrRecord) return "NOT_ASSIGNED";
    return "AVAILABLE";
  } catch {
    return "INTERNAL_ERROR";
  }
}
