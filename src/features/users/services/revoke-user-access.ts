import "server-only";

import { UserRole, UserStatus } from "@prisma/client";
import { z } from "zod";
import { AUDIT_ACTIONS } from "@/features/audit/constants/audit-actions";
import { AUDIT_ENTITY_TYPES } from "@/features/audit/constants/audit-entity-types";
import { validateAuditReason } from "@/features/audit/lib/validate-audit-input";
import { writeAuditLog } from "@/features/audit/services/write-audit-log";
import { requireAdmin } from "@/features/auth/server/auth";
import { prisma } from "@/lib/prisma";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const schema = z.object({ userId: z.string().trim().min(1).max(100), reason: z.unknown() }).strict();
type TargetUser = { id: string; authUserId: string; role: UserRole; status: UserStatus };

export type RevokeUserDependencies = {
  requireAdmin: typeof requireAdmin;
  findTarget: (id: string) => Promise<TargetUser | null>;
  countActiveAdmins: () => Promise<number>;
  deleteAuthUser: (authUserId: string) => Promise<boolean>;
  revokeAppAccess: (target: TargetUser, actorId: string, reason: string) => Promise<void>;
};

async function defaults(): Promise<RevokeUserDependencies> {
  return {
    requireAdmin,
    findTarget: (id) => prisma.user.findUnique({ where: { id }, select: { id: true, authUserId: true, role: true, status: true } }),
    countActiveAdmins: () => prisma.user.count({ where: { role: UserRole.ADMIN, status: UserStatus.ACTIVE } }),
    async deleteAuthUser(authUserId) {
      try {
        const client = createSupabaseAdminClient();
        const { error } = await client.auth.admin.deleteUser(authUserId);
        return !error || error.status === 404;
      } catch {
        return false;
      }
    },
    async revokeAppAccess(target, actorId, reason) {
      await prisma.$transaction(async (tx) => {
        const current = await tx.user.findUnique({ where: { id: target.id }, select: { id: true, role: true, status: true } });
        if (!current) throw new Error("USER_NOT_FOUND");
        if (current.role === UserRole.ADMIN && current.status === UserStatus.ACTIVE) {
          const count = await tx.user.count({ where: { role: UserRole.ADMIN, status: UserStatus.ACTIVE } });
          if (count <= 1) throw new Error("LAST_ACTIVE_ADMIN");
        }
        await tx.user.update({ where: { id: current.id }, data: { status: UserStatus.INACTIVE }, select: { id: true } });
        await writeAuditLog(tx, {
          actor: { type: "USER", userId: actorId },
          action: AUDIT_ACTIONS.USER_ACCESS_REVOKED,
          entityType: AUDIT_ENTITY_TYPES.USER,
          entityId: current.id,
          reason,
          beforeData: { role: current.role, status: current.status },
          afterData: { status: UserStatus.INACTIVE, authAccess: "REVOKED" },
        });
      });
    },
  };
}

export type RevokeUserResult = { ok: true } | { ok: false; code: string; message: string };

export async function revokeUserAccess(input: unknown, dependencies?: RevokeUserDependencies): Promise<RevokeUserResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "INVALID_INPUT", message: "Geçerli bir kullanıcı seçin." };
  let reason: string;
  try {
    reason = validateAuditReason(AUDIT_ACTIONS.USER_ACCESS_REVOKED, parsed.data.reason) as string;
  } catch {
    return { ok: false, code: "INVALID_REASON", message: "İşlem nedeni 10 ile 500 karakter arasında olmalıdır." };
  }
  const resolved = dependencies ?? await defaults();
  let actor;
  try {
    actor = await resolved.requireAdmin();
  } catch {
    return { ok: false, code: "FORBIDDEN", message: "Bu işlem yalnızca yöneticiler tarafından yapılabilir." };
  }
  if (actor.id === parsed.data.userId) return { ok: false, code: "SELF_DELETE", message: "Kendi erişiminizi kaldıramazsınız." };
  const target = await resolved.findTarget(parsed.data.userId);
  if (!target) return { ok: false, code: "NOT_FOUND", message: "Kullanıcı bulunamadı." };
  if (target.role === UserRole.ADMIN && target.status === UserStatus.ACTIVE && await resolved.countActiveAdmins() <= 1) {
    return { ok: false, code: "LAST_ACTIVE_ADMIN", message: "Son aktif yöneticinin erişimi kaldırılamaz." };
  }
  if (!await resolved.deleteAuthUser(target.authUserId)) {
    return { ok: false, code: "AUTH_REVOKE_FAILED", message: "Kimlik doğrulama erişimi kaldırılamadı; uygulama kaydı değiştirilmedi." };
  }
  try {
    await resolved.revokeAppAccess(target, actor.id, reason);
    return { ok: true };
  } catch {
    return { ok: false, code: "AUTH_CLEANUP_REQUIRED", message: "Auth erişimi kaldırıldı ancak uygulama kaydı tamamlanamadı. İşlemi güvenle yeniden deneyin." };
  }
}
