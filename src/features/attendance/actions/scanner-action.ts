"use server";

import { revalidatePath } from "next/cache";
import { requireStaffOrAdmin } from "@/features/auth/server/auth";
import { scanAttendance } from "@/features/attendance/services/scan-attendance";
import { guardMutation } from "@/lib/security/request-guard";

export async function scanAttendanceAction(token: string) {
  if (!await guardMutation("attendance-scanner", { limit: 30, windowMs: 60_000 })) return {ok:false as const,message:"Çok fazla tarama yapıldı. Lütfen kısa süre bekleyin."};
  try { await requireStaffOrAdmin(); } catch { return {ok:false as const,message:"Bu işlem için yetkiniz bulunmuyor."}; }
  const result=await scanAttendance(token);
  if(result.ok)revalidatePath("/dashboard/attendance");
  return result;
}
