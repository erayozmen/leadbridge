import { QrCodeStatus } from "@prisma/client";

export type QrUnassignmentVisibility = {
  role: "ADMIN" | "STAFF";
  status: QrCodeStatus;
  usedAt: Date | null;
  archivedAt: Date | null;
  hasRegistration: boolean;
  hasStudentMatch: boolean;
};

export function canUnassignQrCode(input: QrUnassignmentVisibility): boolean {
  return input.role === "ADMIN"
    && input.status === QrCodeStatus.ASSIGNED
    && input.usedAt === null
    && input.archivedAt === null
    && !input.hasRegistration
    && !input.hasStudentMatch;
}
