import "server-only";
import type { Prisma } from "@prisma/client";
import { resolveSchoolDisplayName } from "@/features/schools/lib/normalize-school-name";
import { parsePageSize, parsePositivePage, parseSort } from "@/lib/query-pagination";

export const ATTENDANCE_PAGE_SIZE=25;
export type AttendanceFilters={eventId?:string;firstName?:string;lastName?:string;school?:string;phone?:string;attendance?:string;attendedByUserId?:string;attendedFrom?:string;attendedTo?:string;page?:number;pageSize?:number;sort?:string};
export type AttendanceListItem={id:string;firstName:string;lastName:string;school:string;schoolRelation:{name:string}|null;phone:string;guardianName:string;registeredAt:Date;attendedEvent:boolean;attendedAt:Date|null;qrCode:{serialNumber:string};studentMatch:{id:string}|null;attendedByUser:{fullName:string}|null};
type Args={where:Prisma.QrRegistrationWhereInput;select:Prisma.QrRegistrationSelect;orderBy:Prisma.QrRegistrationOrderByWithRelationInput;skip:number;take:number};
export type AttendanceListDependencies={count:(where:Prisma.QrRegistrationWhereInput)=>Promise<number>;findMany:(args:Args)=>Promise<AttendanceListItem[]>};
async function defaults():Promise<AttendanceListDependencies>{const{prisma}=await import("@/lib/prisma");return{count:(where)=>prisma.qrRegistration.count({where}),async findMany(args){return await prisma.qrRegistration.findMany(args) as unknown as AttendanceListItem[];}};}
export async function listAttendanceRegistrations(filters:AttendanceFilters,dependencies?:AttendanceListDependencies){
  const firstName=filters.firstName?.trim().slice(0,80)||undefined,lastName=filters.lastName?.trim().slice(0,80)||undefined,school=filters.school?.trim().slice(0,120)||undefined,phone=filters.phone?.trim().slice(0,30)||undefined;
  const page=parsePositivePage(filters.page),pageSize=parsePageSize(filters.pageSize),sort=parseSort(filters.sort,["newest","oldest","name-asc","name-desc"] as const,"newest");
  const attendance=filters.attendance==="attended"?true:filters.attendance==="not-attended"?false:undefined;
  const attendedByUserId=filters.attendedByUserId?.trim().slice(0,100)||undefined;
  const where:Prisma.QrRegistrationWhereInput={...(filters.eventId?{eventId:filters.eventId}:{}),...(firstName?{firstName:{contains:firstName,mode:"insensitive"}}:{}),...(lastName?{lastName:{contains:lastName,mode:"insensitive"}}:{}),...(school?{school:{contains:school,mode:"insensitive"}}:{}),...(phone?{phone:{contains:phone}}:{}),...(attendance!==undefined?{attendedEvent:attendance}:{}),...(attendedByUserId?{attendedByUserId}:{})};
  const orderBy:Prisma.QrRegistrationOrderByWithRelationInput=sort==="oldest"?{registeredAt:"asc"}:sort==="name-asc"?{firstName:"asc"}:sort==="name-desc"?{firstName:"desc"}:{registeredAt:"desc"};
  const deps=dependencies??await defaults();const[total,records]=await Promise.all([deps.count(where),deps.findMany({where,select:{id:true,firstName:true,lastName:true,school:true,schoolRelation:{select:{name:true}},phone:true,guardianName:true,registeredAt:true,attendedEvent:true,attendedAt:true,qrCode:{select:{serialNumber:true}},studentMatch:{select:{id:true}},attendedByUser:{select:{fullName:true}}},orderBy,skip:(page-1)*pageSize,take:pageSize})]);
  return{records:records.map((record)=>({...record,school:resolveSchoolDisplayName(record.schoolRelation,record.school)})),total,page,pageSize,sort,pageCount:Math.max(1,Math.ceil(total/pageSize)),hasFilters:Boolean(firstName||lastName||school||phone||attendance!==undefined||attendedByUserId||sort!=="newest")};
}
