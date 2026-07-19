import "server-only";
import type { Prisma } from "@prisma/client";
import { resolveSchoolDisplayName } from "@/features/schools/lib/normalize-school-name";

export const ATTENDANCE_PAGE_SIZE=20;
export type AttendanceFilters={firstName?:string;lastName?:string;school?:string;phone?:string;page?:number};
export type AttendanceListItem={id:string;firstName:string;lastName:string;school:string;schoolRelation:{name:string}|null;phone:string;guardianName:string;registeredAt:Date;attendedEvent:boolean;attendedAt:Date|null;qrCode:{serialNumber:string};studentMatch:{id:string}|null;attendedByUser:{fullName:string}|null};
type Args={where:Prisma.QrRegistrationWhereInput;select:Prisma.QrRegistrationSelect;orderBy:Prisma.QrRegistrationOrderByWithRelationInput;skip:number;take:number};
export type AttendanceListDependencies={count:(where:Prisma.QrRegistrationWhereInput)=>Promise<number>;findMany:(args:Args)=>Promise<AttendanceListItem[]>};
async function defaults():Promise<AttendanceListDependencies>{const{prisma}=await import("@/lib/prisma");return{count:(where)=>prisma.qrRegistration.count({where}),async findMany(args){return await prisma.qrRegistration.findMany(args) as unknown as AttendanceListItem[];}};}
export async function listAttendanceRegistrations(filters:AttendanceFilters,dependencies?:AttendanceListDependencies){
  const firstName=filters.firstName?.trim().slice(0,80)||undefined,lastName=filters.lastName?.trim().slice(0,80)||undefined,school=filters.school?.trim().slice(0,120)||undefined,phone=filters.phone?.trim().slice(0,30)||undefined;
  const page=Number.isInteger(filters.page)&&(filters.page??0)>0?filters.page!:1;
  const where:Prisma.QrRegistrationWhereInput={...(firstName?{firstName:{contains:firstName,mode:"insensitive"}}:{}),...(lastName?{lastName:{contains:lastName,mode:"insensitive"}}:{}),...(school?{school:{contains:school,mode:"insensitive"}}:{}),...(phone?{phone:{contains:phone}}:{})};
  const deps=dependencies??await defaults();const[total,records]=await Promise.all([deps.count(where),deps.findMany({where,select:{id:true,firstName:true,lastName:true,school:true,schoolRelation:{select:{name:true}},phone:true,guardianName:true,registeredAt:true,attendedEvent:true,attendedAt:true,qrCode:{select:{serialNumber:true}},studentMatch:{select:{id:true}},attendedByUser:{select:{fullName:true}}},orderBy:{registeredAt:"desc"},skip:(page-1)*ATTENDANCE_PAGE_SIZE,take:ATTENDANCE_PAGE_SIZE})]);
  return{records:records.map((record)=>({...record,school:resolveSchoolDisplayName(record.schoolRelation,record.school)})),total,page,pageCount:Math.max(1,Math.ceil(total/ATTENDANCE_PAGE_SIZE)),hasFilters:Boolean(firstName||lastName||school||phone)};
}
