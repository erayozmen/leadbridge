import "server-only";

import { UserRole, UserStatus } from "@prisma/client";
import { z } from "zod";
import { AUDIT_ACTIONS } from "@/features/audit/constants/audit-actions";
import { AUDIT_ENTITY_TYPES } from "@/features/audit/constants/audit-entity-types";
import { writeAuditLog } from "@/features/audit/services/write-audit-log";
import { requireAdmin } from "@/features/auth/server/auth";
import { prisma } from "@/lib/prisma";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().pipe(z.email()),
  role: z.enum(UserRole),
  temporaryPassword: z.string().min(12).max(128),
}).strict();

type ProvisionInput = z.infer<typeof schema>;
type CreatedUser = { id: string; role: UserRole; status: UserStatus };

export type ProvisionUserDependencies = {
  requireAdmin: typeof requireAdmin;
  findDuplicate: (email: string) => Promise<{ id: string } | null>;
  createAuthUser: (input: { email: string; password: string }) => Promise<{ ok: true; id: string } | { ok: false; code: string }>;
  deleteAuthUser: (id: string) => Promise<boolean>;
  createAppUser: (input: ProvisionInput & { authUserId: string; actorUserId: string }) => Promise<CreatedUser>;
  logCleanupFailure: () => void;
};

async function defaults(): Promise<ProvisionUserDependencies> {
  return {
    requireAdmin,
    findDuplicate: (email) => prisma.user.findUnique({ where: { email }, select: { id: true } }),
    async createAuthUser(input) {
      let client;
      try {
        client = createSupabaseAdminClient();
      } catch {
        return { ok: false, code: "AUTH_ADMIN_NOT_CONFIGURED" };
      }
      const { data, error } = await client.auth.admin.createUser({
        email: input.email,
        password: input.password,
        email_confirm: true,
      });
      if (error || !data.user) return { ok: false, code: "AUTH_CREATE_FAILED" };
      return { ok: true, id: data.user.id };
    },
    async deleteAuthUser(id) {
      try {
        const client = createSupabaseAdminClient();
        const { error } = await client.auth.admin.deleteUser(id);
        return !error || error.status === 404;
      } catch {
        return false;
      }
    },
    createAppUser(input) {
      return prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            authUserId: input.authUserId,
            email: input.email,
            fullName: input.fullName,
            role: input.role,
            status: UserStatus.ACTIVE,
          },
          select: { id: true, role: true, status: true },
        });
        await writeAuditLog(tx, {
          actor: { type: "USER", userId: input.actorUserId },
          action: AUDIT_ACTIONS.USER_CREATED,
          entityType: AUDIT_ENTITY_TYPES.USER,
          entityId: user.id,
          afterData: { role: user.role, status: user.status },
        });
        return user;
      });
    },
    logCleanupFailure: () => console.error("[user-provisioning] auth cleanup failed"),
  };
}

export type ProvisionUserResult =
  | { ok: true; user: CreatedUser }
  | { ok: false; code: string; message: string };

export async function provisionUser(input: unknown, dependencies?: ProvisionUserDependencies): Promise<ProvisionUserResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "INVALID_INPUT", message: "Kullanıcı bilgilerini kontrol edin." };
  const resolved = dependencies ?? await defaults();
  let actor;
  try {
    actor = await resolved.requireAdmin();
  } catch {
    return { ok: false, code: "FORBIDDEN", message: "Bu işlem yalnızca yöneticiler tarafından yapılabilir." };
  }
  if (await resolved.findDuplicate(parsed.data.email)) {
    return { ok: false, code: "DUPLICATE_USER", message: "Bu email adresiyle kayıtlı bir kullanıcı zaten var." };
  }
  const auth = await resolved.createAuthUser({ email: parsed.data.email, password: parsed.data.temporaryPassword });
  if (!auth.ok) {
    return {
      ok: false,
      code: auth.code,
      message: auth.code === "AUTH_ADMIN_NOT_CONFIGURED"
        ? "Kullanıcı oluşturma entegrasyonu yapılandırılmamış."
        : "Kimlik doğrulama hesabı oluşturulamadı.",
    };
  }
  try {
    const user = await resolved.createAppUser({ ...parsed.data, authUserId: auth.id, actorUserId: actor.id });
    return { ok: true, user };
  } catch {
    if (!await resolved.deleteAuthUser(auth.id)) {
      resolved.logCleanupFailure();
      return { ok: false, code: "AUTH_CLEANUP_REQUIRED", message: "Kullanıcı kaydı tamamlanamadı ve Auth temizliği doğrulanamadı. Yönetici müdahalesi gerekiyor." };
    }
    return { ok: false, code: "APP_USER_CREATE_FAILED", message: "Kullanıcı kaydı tamamlanamadı; oluşturulan erişim güvenli biçimde temizlendi." };
  }
}
