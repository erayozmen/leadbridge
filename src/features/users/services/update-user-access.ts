import "server-only";

import { UserRole, UserStatus } from "@prisma/client";
import { z } from "zod";
import { AUDIT_ACTIONS } from "@/features/audit/constants/audit-actions";
import { AUDIT_ENTITY_TYPES } from "@/features/audit/constants/audit-entity-types";
import { validateAuditReason } from "@/features/audit/lib/validate-audit-input";
import { requireAdmin } from "@/features/auth/server/auth";
import { AuthError } from "@/features/auth/types/auth";
import { writeAuditLog } from "@/features/audit/services/write-audit-log";
import { prisma } from "@/lib/prisma";

const schema = z.object({ userId: z.string().trim().min(1).max(100), role: z.enum(UserRole).optional(), status: z.enum(UserStatus).optional(), reason: z.unknown() }).strict().refine(value => Boolean(value.role || value.status));
export type UpdateUserAccessResult = { ok: true } | { ok: false; message: string };

export async function updateUserAccess(input: unknown): Promise<UpdateUserAccessResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Geçerli bir kullanıcı değişikliği girin." };
  const action = parsed.data.role ? AUDIT_ACTIONS.USER_ROLE_CHANGED : AUDIT_ACTIONS.USER_STATUS_CHANGED;
  let reason: string;
  try { reason = validateAuditReason(action, parsed.data.reason) as string; } catch { return { ok: false, message: "İşlem nedeni 10 ile 500 karakter arasında olmalıdır." }; }
  let actor;
  try { actor = await requireAdmin(); } catch (error) { return { ok: false, message: error instanceof AuthError ? "Bu işlem yalnızca yöneticiler tarafından yapılabilir." : "Yetkilendirme doğrulanamadı." }; }
  if (actor.id === parsed.data.userId && parsed.data.status === UserStatus.INACTIVE) return { ok: false, message: "Kendi hesabınızı pasif yapamazsınız." };
  try {
    return await prisma.$transaction(async tx => {
      const current = await tx.user.findUnique({ where: { id: parsed.data.userId }, select: { id: true, role: true, status: true } });
      if (!current) return { ok: false as const, message: "Kullanıcı bulunamadı." };
      const nextRole = parsed.data.role ?? current.role;
      const nextStatus = parsed.data.status ?? current.status;
      const removesAdmin = current.role === UserRole.ADMIN && current.status === UserStatus.ACTIVE && (nextRole !== UserRole.ADMIN || nextStatus !== UserStatus.ACTIVE);
      if (removesAdmin && await tx.user.count({ where: { role: UserRole.ADMIN, status: UserStatus.ACTIVE } }) <= 1) return { ok: false as const, message: "Son aktif yönetici değiştirilemez." };
      await tx.user.update({ where: { id: current.id }, data: { role: nextRole, status: nextStatus }, select: { id: true } });
      await writeAuditLog(tx, { actor: { type: "USER", userId: actor.id }, action, entityType: AUDIT_ENTITY_TYPES.USER, entityId: current.id, reason, beforeData: { role: current.role, status: current.status }, afterData: { role: nextRole, status: nextStatus } });
      return { ok: true as const };
    });
  } catch { return { ok: false, message: "Kullanıcı yetkisi güncellenemedi. Lütfen tekrar deneyin." }; }
}
