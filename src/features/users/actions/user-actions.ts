"use server";

import { revalidatePath } from "next/cache";
import { updateUserAccess } from "@/features/users/services/update-user-access";
import { requireAdmin } from "@/features/auth/server/auth";
import { provisionUser } from "@/features/users/services/provision-user";
import { revokeUserAccess } from "@/features/users/services/revoke-user-access";

export type UserAccessActionState = { status: "idle" | "success" | "error"; message: string | null };

const text = (formData: FormData, name: string) => {
  const item = formData.get(name);
  return typeof item === "string" ? item : "";
};

export async function updateUserAccessAction(_state: UserAccessActionState, formData: FormData): Promise<UserAccessActionState> {
  try { await requireAdmin(); } catch { return { status: "error", message: "Bu işlem yalnızca yöneticiler tarafından yapılabilir." }; }
  const value = (name: string) => { const item = formData.get(name); return typeof item === "string" ? item : ""; };
  const kind = value("kind");
  const result = await updateUserAccess({ userId: value("userId"), reason: value("reason"), ...(kind === "role" ? { role: value("value") } : { status: value("value") }) });
  if (!result.ok) return { status: "error", message: result.message };
  revalidatePath("/dashboard/users");
  return { status: "success", message: "Kullanıcı erişimi güncellendi." };
}

export async function createUserAction(_state: UserAccessActionState, formData: FormData): Promise<UserAccessActionState> {
  try { await requireAdmin(); } catch { return { status: "error", message: "Bu işlem yalnızca yöneticiler tarafından yapılabilir." }; }
  const input = { fullName: text(formData, "fullName").trim(), email: text(formData, "email").trim(), role: text(formData, "role"), temporaryPassword: text(formData, "temporaryPassword") };
  if (input.fullName.length < 2 || !input.email.includes("@") || !["ADMIN", "STAFF"].includes(input.role) || input.temporaryPassword.length < 12) {
    return { status: "error", message: "Kullanıcı bilgilerini kontrol edin." };
  }
  const result = await provisionUser(input);
  if (!result.ok) return { status: "error", message: result.message };
  revalidatePath("/dashboard/users");
  return { status: "success", message: "Kullanıcı hesabı oluşturuldu." };
}

export async function revokeUserAccessAction(_state: UserAccessActionState, formData: FormData): Promise<UserAccessActionState> {
  try { await requireAdmin(); } catch { return { status: "error", message: "Bu işlem yalnızca yöneticiler tarafından yapılabilir." }; }
  const userId = text(formData, "userId").trim();
  const reason = text(formData, "reason").trim();
  if (!userId || reason.length < 10 || reason.length > 500) return { status: "error", message: "İşlem nedeni 10 ile 500 karakter arasında olmalıdır." };
  const result = await revokeUserAccess({ userId, reason });
  if (!result.ok) return { status: "error", message: result.message };
  revalidatePath("/dashboard/users");
  return { status: "success", message: "Kullanıcının uygulama ve giriş erişimi kalıcı olarak kaldırıldı." };
}
