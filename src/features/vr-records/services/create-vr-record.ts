import "server-only";

import type { AppUser } from "@/features/auth/types/auth";
import { AuthError } from "@/features/auth/types/auth";
import {
  type VrRecordInput,
  vrRecordSchema,
} from "@/features/vr-records/schemas/vr-record.schema";
import type { CreateVrRecordResult } from "@/features/vr-records/types/vr-record-result";

type VrRecordCreateData = {
  firstName: string;
  lastName: string;
  school: string;
  schoolId: string;
  phone: string | null;
  createdByUserId: string;
};

export type CreateVrRecordDependencies = {
  requireUser: () => Promise<AppUser>;
  findActiveSchool: (id: string) => Promise<{ id: string; name: string } | null>;
  createRecord: (data: VrRecordCreateData) => Promise<{
    id: string;
    firstName: string;
    lastName: string;
    school: string;
    phone: string | null;
    createdAt: Date;
  }>;
};

async function getDefaultDependencies(): Promise<CreateVrRecordDependencies> {
  const [{ requireStaffOrAdmin }, { prisma }] = await Promise.all([
    import("@/features/auth/server/auth"),
    import("@/lib/prisma"),
  ]);

  return {
    requireUser: requireStaffOrAdmin,
    findActiveSchool: (id) => prisma.school.findFirst({ where: { id, status: "ACTIVE" }, select: { id: true, name: true } }),
    createRecord(data) {
      return prisma.vrRecord.create({
        data,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          school: true,
          phone: true,
          createdAt: true,
        },
      });
    },
  };
}

export async function createVrRecord(
  input: VrRecordInput,
  dependencies?: CreateVrRecordDependencies,
): Promise<CreateVrRecordResult> {
  const parsedInput = vrRecordSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "Lütfen form alanlarını kontrol edin.",
      fieldErrors: parsedInput.error.flatten().fieldErrors,
    };
  }

  try {
    const resolved = dependencies ?? (await getDefaultDependencies());
    const user = await resolved.requireUser();
    const school = await resolved.findActiveSchool(parsedInput.data.schoolId);
    if (!school) return { ok: false, code: "INVALID_INPUT", message: "Seçilen okul aktif değil veya bulunamadı.", fieldErrors: { schoolId: ["Aktif bir okul seçin."] } };
    const record = await resolved.createRecord({
      firstName: parsedInput.data.firstName,
      lastName: parsedInput.data.lastName,
      phone: parsedInput.data.phone,
      schoolId: school.id,
      school: school.name,
      createdByUserId: user.id,
    });

    return { ok: true, record };
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        ok: false,
        code: error.code === "USER_INACTIVE" ? "USER_INACTIVE" : "UNAUTHORIZED",
        message:
          error.code === "USER_INACTIVE"
            ? "Kullanıcı hesabınız aktif değil."
            : "Bu işlem için yetkiniz bulunmuyor.",
      };
    }

    return {
      ok: false,
      code: "CREATE_FAILED",
      message: "VR kaydı oluşturulamadı. Lütfen tekrar deneyin.",
    };
  }
}
