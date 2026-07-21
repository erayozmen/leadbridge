"use server";

import { revalidatePath } from "next/cache";
import { requireStaffOrAdmin } from "@/features/auth/server/auth";
import { scanAttendance } from "@/features/attendance/services/scan-attendance";

export async function scanAttendanceAction(token: string) {
  try { await requireStaffOrAdmin(); } catch { return {ok:false as const,message:"Bu işlem için yetkiniz bulunmuyor."}; }
  const result=await scanAttendance(token);
  if(result.ok)revalidatePath("/dashboard/attendance");
  return result;
}
