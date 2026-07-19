"use server";
import{revalidatePath}from"next/cache";
import{markAttendance}from"@/features/attendance/services/mark-attendance";
export type AttendanceActionState={status:"idle"|"success"|"error";message:string|null};
export async function markAttendanceAction(_state:AttendanceActionState,formData:FormData):Promise<AttendanceActionState>{const value=formData.get("qrRegistrationId");const result=await markAttendance({qrRegistrationId:typeof value==="string"?value:""});if(!result.ok)return{status:"error",message:result.message};revalidatePath("/dashboard/attendance");return{status:"success",message:"Öğrenci etkinliğe katıldı olarak işaretlendi."};}
