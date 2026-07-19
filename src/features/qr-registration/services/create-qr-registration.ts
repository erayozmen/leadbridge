import "server-only";

import { Prisma, QrCodeStatus, SchoolStatus } from "@prisma/client";

import { hashQrToken } from "@/features/qr-registration/lib/hash-qr-token";
import {
  type QrRegistrationData,
  type QrRegistrationInput,
  qrRegistrationSchema,
} from "@/features/qr-registration/schemas/qr-registration.schema";
import type {
  QrRegistrationFailure,
  QrRegistrationResult,
} from "@/features/qr-registration/types/qr-registration-result";

type QrRegistrationTransactionClient = Pick<
  Prisma.TransactionClient,
  "qrCode" | "qrRegistration" | "school"
>;

type QrRegistrationPrismaClient = {
  $transaction<T>(
    callback: (tx: QrRegistrationTransactionClient) => Promise<T>,
  ): Promise<T>;
};

class QrRegistrationDomainError extends Error {
  constructor(readonly failure: QrRegistrationFailure) {
    super(failure.code);
  }
}

function failure(
  code: QrRegistrationFailure["code"],
  message: string,
): QrRegistrationFailure {
  return { ok: false, code, message };
}

function mapQrStatusToFailure(status: QrCodeStatus): QrRegistrationFailure {
  if (status === QrCodeStatus.CREATED) {
    return failure("QR_NOT_ASSIGNED", "This QR code is not assigned yet.");
  }

  if (status === QrCodeStatus.DISABLED) {
    return failure("QR_DISABLED", "This QR code is disabled.");
  }

  return failure("QR_ALREADY_USED", "This QR code has already been used.");
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

async function getDefaultPrismaClient(): Promise<QrRegistrationPrismaClient> {
  const { prisma } = await import("@/lib/prisma");

  return prisma;
}

async function createRegistrationInTransaction(
  data: QrRegistrationData,
  prismaClient: QrRegistrationPrismaClient,
) {
  const tokenHash = hashQrToken(data.token);

  return prismaClient.$transaction(async (tx) => {
    const qrCode = await tx.qrCode.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        status: true,
        qrRegistration: {
          select: { id: true },
        },
        assignedVrRecord: {
          select: { id: true },
        },
      },
    });

    if (!qrCode) {
      throw new QrRegistrationDomainError(
        failure("QR_NOT_FOUND", "This QR code is not valid."),
      );
    }

    if (qrCode.qrRegistration) {
      throw new QrRegistrationDomainError(
        failure(
          "QR_REGISTRATION_CONFLICT",
          "A registration already exists for this QR code.",
        ),
      );
    }

    if (qrCode.status !== QrCodeStatus.ASSIGNED) {
      throw new QrRegistrationDomainError(
        mapQrStatusToFailure(qrCode.status),
      );
    }

    if (!qrCode.assignedVrRecord) {
      throw new QrRegistrationDomainError(
        failure("QR_NOT_ASSIGNED", "This QR code is not linked to a VR record."),
      );
    }

    const school = await tx.school.findUnique({ where: { id: data.schoolId }, select: { id: true, name: true, status: true } });
    if (!school) throw new QrRegistrationDomainError(failure("SCHOOL_NOT_FOUND", "The selected school does not exist."));
    if (school.status !== SchoolStatus.ACTIVE) throw new QrRegistrationDomainError(failure("SCHOOL_INACTIVE", "The selected school is inactive."));

    const now = new Date();
    const qrUpdate = await tx.qrCode.updateMany({
      where: {
        id: qrCode.id,
        status: QrCodeStatus.ASSIGNED,
        assignedVrRecord: { isNot: null },
      },
      data: {
        status: QrCodeStatus.USED,
        usedAt: now,
      },
    });

    if (qrUpdate.count !== 1) {
      throw new QrRegistrationDomainError(
        failure(
          "QR_REGISTRATION_CONFLICT",
          "This QR code is already being registered.",
        ),
      );
    }

    const registration = await tx.qrRegistration.create({
      data: {
        qrCodeId: qrCode.id,
        firstName: data.firstName,
        lastName: data.lastName,
        guardianName: data.guardianName,
        phone: data.phone,
        schoolId: school.id,
        school: school.name,
        registeredAt: now,
      },
      select: {
        id: true,
        qrCodeId: true,
        firstName: true,
        lastName: true,
        guardianName: true,
        phone: true,
        school: true,
        schoolId: true,
        registeredAt: true,
      },
    });
    return { ...registration, schoolId: school.id };
  });
}

export async function createQrRegistration(
  input: QrRegistrationInput,
  prismaClient?: QrRegistrationPrismaClient,
): Promise<QrRegistrationResult> {
  const parsedInput = qrRegistrationSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "Registration data is invalid.",
      fieldErrors: parsedInput.error.flatten().fieldErrors,
    };
  }

  try {
    const activePrismaClient = prismaClient ?? (await getDefaultPrismaClient());
    const registration = await createRegistrationInTransaction(
      parsedInput.data,
      activePrismaClient,
    );

    return {
      ok: true,
      registration,
    };
  } catch (error) {
    if (error instanceof QrRegistrationDomainError) {
      return error.failure;
    }

    if (isUniqueConstraintError(error)) {
      return failure(
        "QR_REGISTRATION_CONFLICT",
        "A registration already exists for this QR code.",
      );
    }

    return failure(
      "INTERNAL_ERROR",
      "Registration could not be completed. Please try again.",
    );
  }
}
