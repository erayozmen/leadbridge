import "server-only";

import { requireAdmin, requireStaffOrAdmin } from "@/features/auth/server/auth";
import { buildCsv } from "@/features/exports/lib/csv";
import { prisma } from "@/lib/prisma";

export const EXPORT_TYPES = ["vr-records", "qr-codes", "qr-registrations", "attendance", "non-attendance", "course-enrollments", "schools", "audit-logs"] as const;
export type ExportType = typeof EXPORT_TYPES[number];
const LIMIT = 5000;

const text = (params: URLSearchParams, key: string, max: number) => params.get(key)?.trim().slice(0, max) || undefined;

export async function buildDataExport(type: ExportType, params = new URLSearchParams()) {
  if (["audit-logs", "course-enrollments", "schools", "qr-codes", "qr-registrations"].includes(type)) await requireAdmin(); else await requireStaffOrAdmin();
  const date = new Date().toISOString().slice(0, 10);
  if (type === "vr-records") {
    const firstName=text(params,"firstName",80),lastName=text(params,"lastName",80),schoolId=text(params,"schoolId",100),matchStatus=text(params,"matchStatus",20);
    const rows = await prisma.vrRecord.findMany({ where:{...(firstName?{firstName:{contains:firstName,mode:"insensitive" as const}}:{}),...(lastName?{lastName:{contains:lastName,mode:"insensitive" as const}}:{}),...(schoolId?{schoolId}:{}),...(matchStatus==="matched"?{studentMatch:{isNot:null}}:matchStatus==="unmatched"?{studentMatch:{is:null}}:{})}, select: { firstName: true, lastName: true, school: true, phone: true, createdAt: true, assignedQrCode: { select: { serialNumber: true } } }, orderBy: { createdAt: "desc" }, take: LIMIT });
    return { filename: `vr-kayitlari-${date}.csv`, csv: buildCsv(["Ad", "Soyad", "Okul", "Telefon", "QR", "Tarih"], rows.map(row => [row.firstName, row.lastName, row.school, row.phone, row.assignedQrCode?.serialNumber, row.createdAt.toISOString()])) };
  }
  if (type === "qr-codes") {
    const serial=text(params,"serialNumber",32),status=text(params,"status",20),archive=text(params,"archive",20);
    const rows = await prisma.qrCode.findMany({ where:{...(serial?{serialNumber:{contains:serial,mode:"insensitive" as const}}:{}),...(["CREATED","ASSIGNED","USED","DISABLED"].includes(status??"")?{status:status as "CREATED"|"ASSIGNED"|"USED"|"DISABLED"}:{}),...(archive==="archived"?{archivedAt:{not:null}}:archive==="all"?{}:{archivedAt:null})}, select: { serialNumber: true, status: true, assignedAt: true, usedAt: true, archivedAt: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: LIMIT });
    return { filename: `qr-kodlari-${date}.csv`, csv: buildCsv(["Seri", "Durum", "Atanma", "Kullanılma", "Arşiv", "Tarih"], rows.map(row => [row.serialNumber, row.status, row.assignedAt?.toISOString(), row.usedAt?.toISOString(), row.archivedAt?.toISOString(), row.createdAt.toISOString()])) };
  }
  if (type === "audit-logs") {
    const action=text(params,"action",100),entityType=text(params,"entityType",100),entityId=text(params,"entityId",120),reason=text(params,"reason",160);
    const rows = await prisma.auditLog.findMany({ where:{...(action?{action}:{}),...(entityType?{entityType}:{}),...(entityId?{entityId:{contains:entityId,mode:"insensitive" as const}}:{}),...(reason?{reason:{contains:reason,mode:"insensitive" as const}}:{})}, select: { createdAt: true, action: true, entityType: true, entityId: true, reason: true, actorUser: { select: { fullName: true } } }, orderBy: { createdAt: "desc" }, take: LIMIT });
    return { filename: `denetim-kayitlari-${date}.csv`, csv: buildCsv(["Tarih", "İşlem", "Varlık", "Kayıt ID", "Aktör", "Neden"], rows.map(row => [row.createdAt.toISOString(), row.action, row.entityType, row.entityId, row.actorUser?.fullName, row.reason])) };
  }
  if (type === "schools") {
    const rows = await prisma.school.findMany({ select: { name: true, status: true, _count: { select: { vrRecords: true, qrRegistrations: true } } }, orderBy: { name: "asc" }, take: LIMIT });
    return { filename: `okullar-${date}.csv`, csv: buildCsv(["Okul", "Durum", "VR", "QR Kayıt"], rows.map(row => [row.name, row.status, row._count.vrRecords, row._count.qrRegistrations])) };
  }
  const firstName=text(params,"firstName",80),lastName=text(params,"lastName",80),school=text(params,"school",120),phone=text(params,"phone",30);
  const where = { ...(type === "attendance" ? { attendedEvent: true } : type === "non-attendance" ? { attendedEvent: false } : type === "course-enrollments" ? { enrolledCourse: true } : {}),...(firstName?{firstName:{contains:firstName,mode:"insensitive" as const}}:{}),...(lastName?{lastName:{contains:lastName,mode:"insensitive" as const}}:{}),...(school?{school:{contains:school,mode:"insensitive" as const}}:{}),...(phone?{phone:{contains:phone}}:{}) };
  const rows = await prisma.qrRegistration.findMany({ where, select: { firstName: true, lastName: true, school: true, phone: true, registeredAt: true, attendedEvent: true, attendedAt: true, enrolledCourse: true, enrolledAt: true, qrCode: { select: { serialNumber: true } } }, orderBy: { registeredAt: "desc" }, take: LIMIT });
  return { filename: `${type}-${date}.csv`, csv: buildCsv(["Ad", "Soyad", "Okul", "Telefon", "QR", "Kayıt", "Katılım", "Kurs Kaydı"], rows.map(row => [row.firstName, row.lastName, row.school, row.phone, row.qrCode.serialNumber, row.registeredAt.toISOString(), row.attendedEvent ? row.attendedAt?.toISOString() : "Hayır", row.enrolledCourse ? row.enrolledAt?.toISOString() : "Hayır"])) };
}
