import "server-only";

import { QrCodeStatus } from "@prisma/client";
import { z } from "zod";
import { requireStaffOrAdmin } from "@/features/auth/server/auth";
import { AuthError } from "@/features/auth/types/auth";
import { hashQrToken } from "@/features/qr-registration/lib/hash-qr-token";
import { prisma } from "@/lib/prisma";

const schema = z.string().trim().min(16).max(512);
export type ScanAttendanceResult = { ok: true; studentName: string } | { ok: false; code: "INVALID_TOKEN"|"NOT_FOUND"|"NOT_AVAILABLE"|"ALREADY_ATTENDED"|"UNAUTHORIZED"|"FAILED"; message: string };
const failure = (code: Exclude<ScanAttendanceResult,{ok:true}>["code"],message:string) => ({ok:false as const,code,message});

export async function scanAttendance(rawToken: unknown): Promise<ScanAttendanceResult> {
  const parsed = schema.safeParse(rawToken);
  if (!parsed.success) return failure("INVALID_TOKEN","QR bağlantısı geçerli değil.");
  let user;
  try { user = await requireStaffOrAdmin(); } catch (error) { return failure("UNAUTHORIZED",error instanceof AuthError?"Bu işlem için yetkiniz bulunmuyor.":"Yetkilendirme doğrulanamadı."); }
  try {
    const tokenHash = hashQrToken(parsed.data);
    return await prisma.$transaction(async tx => {
      const qr = await tx.qrCode.findUnique({ where:{tokenHash}, select:{id:true,status:true,archivedAt:true,qrRegistration:{select:{id:true,firstName:true,lastName:true,attendedEvent:true}}} });
      if (!qr || !qr.qrRegistration) return failure("NOT_FOUND","Bu QR için öğrenci kaydı bulunamadı.");
      if (qr.archivedAt || qr.status!==QrCodeStatus.USED) return failure("NOT_AVAILABLE","QR katılım işlemi için uygun değil.");
      if (qr.qrRegistration.attendedEvent) return failure("ALREADY_ATTENDED","Öğrenci daha önce katıldı olarak işaretlenmiş.");
      const now=new Date();
      const updated=await tx.qrRegistration.updateMany({where:{id:qr.qrRegistration.id,attendedEvent:false},data:{attendedEvent:true,attendedAt:now,attendedByUserId:user.id}});
      if(updated.count!==1)return failure("ALREADY_ATTENDED","Katılım başka bir görevli tarafından işlendi.");
      return {ok:true as const,studentName:`${qr.qrRegistration.firstName} ${qr.qrRegistration.lastName}`};
    });
  } catch { return failure("FAILED","Katılım işlemi tamamlanamadı."); }
}
