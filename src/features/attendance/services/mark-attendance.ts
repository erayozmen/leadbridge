import "server-only";

import { z } from "zod";
import { AuthError, type AppUser } from "@/features/auth/types/auth";
import type { AttendanceResult } from "@/features/attendance/types/attendance-result";

type RecordState = { id: string; attendedEvent: boolean };
export type MarkAttendanceDependencies = {
  requireUser: () => Promise<AppUser>;
  findRegistration: (id: string) => Promise<RecordState | null>;
  updateIfNotAttended: (id: string, data: { attendedEvent: true; attendedAt: Date; attendedByUserId: string }) => Promise<number>;
};
const failure = (code: Exclude<AttendanceResult,{ok:true}>["code"],message:string)=>({ok:false as const,code,message});

async function defaults():Promise<MarkAttendanceDependencies>{
  const [{requireStaffOrAdmin},{requireSelectedEvent},{prisma}]=await Promise.all([import("@/features/auth/server/auth"),import("@/features/events/server/event-context"),import("@/lib/prisma")]);
  const event=await requireSelectedEvent({operational:true});
  return {requireUser:requireStaffOrAdmin,findRegistration:(id)=>prisma.qrRegistration.findFirst({where:{id,eventId:event.id},select:{id:true,attendedEvent:true}}),async updateIfNotAttended(id,data){return(await prisma.qrRegistration.updateMany({where:{id,eventId:event.id,attendedEvent:false},data})).count;}};
}

export async function markAttendance(input:{qrRegistrationId:string},dependencies?:MarkAttendanceDependencies):Promise<AttendanceResult>{
  const parsed=z.object({qrRegistrationId:z.string().trim().min(1).max(100)}).safeParse(input);
  if(!parsed.success)return failure("INVALID_INPUT","Geçerli bir öğrenci kaydı seçin.");
  const deps=dependencies??await defaults(); let user:AppUser;
  try{user=await deps.requireUser();}catch(error){if(error instanceof AuthError)return failure("UNAUTHORIZED","Bu işlem için yetkiniz bulunmuyor.");return failure("UNAUTHORIZED","Yetkilendirme doğrulanamadı.");}
  try{
    const existing=await deps.findRegistration(parsed.data.qrRegistrationId);
    if(!existing)return failure("REGISTRATION_NOT_FOUND","Öğrenci kaydı bulunamadı.");
    if(existing.attendedEvent)return failure("ALREADY_ATTENDED","Öğrenci daha önce katıldı olarak işaretlenmiş.");
    const attendedAt=new Date();
    const count=await deps.updateIfNotAttended(existing.id,{attendedEvent:true,attendedAt,attendedByUserId:user.id});
    if(count===1)return{ok:true,attendedAt};
    const current=await deps.findRegistration(existing.id);
    if(!current)return failure("REGISTRATION_NOT_FOUND","Öğrenci kaydı bulunamadı.");
    if(current.attendedEvent)return failure("ALREADY_ATTENDED","Öğrenci başka bir görevli tarafından katıldı olarak işaretlenmiş.");
    return failure("ATTENDANCE_CONFLICT","Katılım durumu başka bir işlem tarafından değiştirildi.");
  }catch{return failure("ATTENDANCE_FAILED","Katılım işaretlenemedi. Lütfen tekrar deneyin.");}
}
