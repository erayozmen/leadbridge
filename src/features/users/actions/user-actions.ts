"use server";

import { revalidatePath } from "next/cache";
import { updateUserAccess } from "@/features/users/services/update-user-access";
import { requireAdmin } from "@/features/auth/server/auth";

export type UserAccessActionState = { status: "idle" | "success" | "error"; message: string | null };

export async function updateUserAccessAction(_state: UserAccessActionState, formData: FormData): Promise<UserAccessActionState> {
  try { await requireAdmin(); } catch { return { status: "error", message: "Bu işlem yalnızca yöneticiler tarafından yapılabilir." }; }
  const value = (name: string) => { const item = formData.get(name); return typeof item === "string" ? item : ""; };
  const kind = value("kind");
  const result = await updateUserAccess({ userId: value("userId"), reason: value("reason"), ...(kind === "role" ? { role: value("value") } : { status: value("value") }) });
  if (!result.ok) return { status: "error", message: result.message };
  revalidatePath("/dashboard/users");
  return { status: "success", message: "Kullanıcı erişimi güncellendi." };
}
