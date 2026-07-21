import "server-only";

import { Prisma, QrCodeStatus } from "@prisma/client";

import { AuthError } from "@/features/auth/types/auth";
import { hashQrToken } from "@/features/qr-registration/lib/hash-qr-token";
import { createQrCsv } from "@/features/qr-codes/lib/qr-csv";
import { generateQrToken } from "@/features/qr-codes/lib/generate-qr-token";
import { type GenerateQrCodesInput, generateQrCodesSchema } from "@/features/qr-codes/schemas/generate-qr-codes.schema";
import type { GenerateQrCodesResult } from "@/features/qr-codes/types/qr-code-result";

type QrCreateData = {
  serialNumber: string;
  tokenHash: string;
  status: QrCodeStatus;
  assignedAt: null;
  usedAt: null;
  eventId: string;
};

type QrTransaction = {
  findLatestSerial: () => Promise<string | null>;
  createMany: (data: QrCreateData[]) => Promise<void>;
};

export type GenerateQrCodesDependencies = {
  requireAdmin: () => Promise<unknown>;
  getAppUrl: () => string;
  generateToken: () => string;
  getActiveEventId?: () => Promise<string>;
  runTransaction: <T>(callback: (transaction: QrTransaction) => Promise<T>) => Promise<T>;
};

function parseSerialNumber(serialNumber: string | null): number {
  if (!serialNumber) return 0;
  const match = /^LB-(\d+)$/.exec(serialNumber);
  return match ? Number(match[1]) : 0;
}

function formatSerialNumber(value: number): string {
  return `LB-${String(value).padStart(6, "0")}`;
}

function isRetryableConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2002" || error.code === "P2034")
  );
}

async function getDefaultDependencies(): Promise<GenerateQrCodesDependencies> {
  const [{ requireAdmin }, { getPublicAppUrl }, { prisma }, { requireActiveEvent }] = await Promise.all([
    import("@/features/auth/server/auth"),
    import("@/lib/env"),
    import("@/lib/prisma"),
    import("@/features/events/server/active-event"),
  ]);

  return {
    requireAdmin,
    getAppUrl: getPublicAppUrl,
    generateToken: generateQrToken,
    getActiveEventId: async () => (await requireActiveEvent()).id,
    runTransaction(callback) {
      return prisma.$transaction(
        async (tx) =>
          callback({
            async findLatestSerial() {
              const latest = await tx.qrCode.findFirst({
                where: { serialNumber: { startsWith: "LB-" } },
                orderBy: { serialNumber: "desc" },
                select: { serialNumber: true },
              });
              return latest?.serialNumber ?? null;
            },
            async createMany(data) {
              await tx.qrCode.createMany({ data });
            },
          }),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    },
  };
}

export async function generateQrCodes(
  input: GenerateQrCodesInput,
  dependencies?: GenerateQrCodesDependencies,
): Promise<GenerateQrCodesResult> {
  const parsed = generateQrCodesSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "INVALID_INPUT", message: "Geçerli bir üretim adedi girin.", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const resolved = dependencies ?? (await getDefaultDependencies());

  try {
    await resolved.requireAdmin();
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, code: "UNAUTHORIZED", message: "Bu işlem yalnızca yöneticiler tarafından yapılabilir." };
    return { ok: false, code: "UNAUTHORIZED", message: "Yetkilendirme doğrulanamadı." };
  }

  let appUrl: string;
  try {
    appUrl = new URL(resolved.getAppUrl()).origin;
  } catch {
    return { ok: false, code: "CONFIG_MISSING", message: "Uygulama adresi yapılandırılmadığı için QR kartları üretilemedi." };
  }
  let eventId: string;
  try { eventId = await resolved.getActiveEventId?.() ?? "test-event"; } catch { return { ok: false, code: "CREATE_FAILED", message: "Aktif etkinlik seçilmeden QR üretilemez." }; }

  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await resolved.runTransaction(async (transaction) => {
        const firstSequence = parseSerialNumber(await transaction.findLatestSerial()) + 1;
        const output = Array.from({ length: parsed.data.quantity }, (_, index) => {
          const serialNumber = formatSerialNumber(firstSequence + index);
          const token = resolved.generateToken();
          return {
            serialNumber,
            tokenHash: hashQrToken(token),
            registrationUrl: new URL(`/r/${token}`, appUrl).toString(),
          };
        });

        await transaction.createMany(
          output.map(({ serialNumber, tokenHash }) => ({
            serialNumber,
            tokenHash,
            status: QrCodeStatus.CREATED,
            assignedAt: null,
            usedAt: null,
            eventId,
          })),
        );

        return {
          ok: true as const,
          count: output.length,
          firstSerialNumber: output[0].serialNumber,
          lastSerialNumber: output.at(-1)!.serialNumber,
          csv: createQrCsv(output),
          rows: output.map(({ serialNumber, registrationUrl }) => ({
            serialNumber,
            registrationUrl,
          })),
        };
      });
    } catch (error) {
      if (isRetryableConflict(error)) {
        if (attempt < maxAttempts) continue;
        return { ok: false, code: "SERIAL_CONFLICT", message: "Seri numarası çakışması nedeniyle üretim tamamlanamadı. Lütfen tekrar deneyin." };
      }
      return { ok: false, code: "CREATE_FAILED", message: "QR kartları oluşturulamadı. Lütfen tekrar deneyin." };
    }
  }

  return { ok: false, code: "CREATE_FAILED", message: "QR kartları oluşturulamadı." };
}
