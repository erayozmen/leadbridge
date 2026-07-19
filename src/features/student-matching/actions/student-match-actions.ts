"use server";

import { revalidatePath } from "next/cache";
import { createStudentMatch } from "@/features/student-matching/services/create-student-match";
import { deleteStudentMatch } from "@/features/student-matching/services/delete-student-match";

export type MatchActionState = { status: "idle" | "success" | "error"; message: string | null };
const text = (data: FormData, name: string) => { const value = data.get(name); return typeof value === "string" ? value : ""; };

export async function createStudentMatchAction(_state: MatchActionState, formData: FormData): Promise<MatchActionState> {
  const result = await createStudentMatch({ vrRecordId: text(formData, "vrRecordId"), qrRegistrationId: text(formData, "qrRegistrationId") });
  if (!result.ok) return { status: "error", message: result.message };
  revalidatePath("/dashboard/vr-records"); revalidatePath("/dashboard/qr-registrations");
  return { status: "success", message: "Kayıtlar başarıyla eşleştirildi." };
}

export async function deleteStudentMatchAction(_state: MatchActionState, formData: FormData): Promise<MatchActionState> {
  const result = await deleteStudentMatch(text(formData, "matchId"));
  if (!result.ok) return { status: "error", message: result.message };
  revalidatePath("/dashboard/vr-records"); revalidatePath("/dashboard/qr-registrations");
  return { status: "success", message: result.message };
}
