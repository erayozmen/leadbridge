"use server";

import { revalidatePath } from "next/cache";
import { updateUserAccess } from "@/features/users/services/update-user-access";
import { requireAdmin } from "@/features/auth/server/auth";

export async function updateUserAccessAction(formData: FormData) {
  try { await requireAdmin(); } catch { return; }
  const value = (name: string) => { const item = formData.get(name); return typeof item === "string" ? item : ""; };
  const kind = value("kind");
  const result = await updateUserAccess({ userId: value("userId"), reason: value("reason"), ...(kind === "role" ? { role: value("value") } : { status: value("value") }) });
  if (result.ok) revalidatePath("/dashboard/users");
}
