import "server-only";

import { parse } from "csv-parse/sync";
import { z } from "zod";
import { requireAdmin } from "@/features/auth/server/auth";
import { normalizeSchoolName } from "@/features/schools/lib/normalize-school-name";
import { prisma } from "@/lib/prisma";

const MAX_BYTES=2*1024*1024,MAX_ROWS=500;
const rowSchema=z.object({firstName:z.string().trim().min(1).max(80),lastName:z.string().trim().min(1).max(80),school:z.string().trim().min(1).max(120),phone:z.string().trim().max(30).optional().default("")}).strict();
type ValidRow=z.infer<typeof rowSchema>&{schoolId:string;rowNumber:number};
export type VrImportResult={ok:true;preview:boolean;validCount:number;rows:Array<{rowNumber:number;firstName:string;lastName:string;school:string}>}|{ok:false;message:string;errors:Array<{rowNumber:number;message:string}>};

export async function importVrRecords(file:File,commit=false):Promise<VrImportResult>{
  const admin=await requireAdmin();
  if(file.size>MAX_BYTES||!file.name.toLowerCase().endsWith(".csv"))return{ok:false,message:"Yalnızca 2 MB altındaki CSV dosyaları kabul edilir.",errors:[]};
  let parsed:unknown[];try{parsed=parse(await file.text(),{columns:true,bom:true,skip_empty_lines:true,trim:true});}catch{return{ok:false,message:"CSV dosyası okunamadı.",errors:[]};}
  if(!parsed.length||parsed.length>MAX_ROWS)return{ok:false,message:`Dosya 1-${MAX_ROWS} kayıt içermelidir.`,errors:[]};
  const schools=await prisma.school.findMany({where:{status:"ACTIVE"},select:{id:true,name:true,normalizedName:true}});const schoolMap=new Map(schools.map(s=>[s.normalizedName,s]));const errors:Array<{rowNumber:number;message:string}>=[];const rows:ValidRow[]=[];const seen=new Set<string>();
  parsed.forEach((raw,index)=>{const result=rowSchema.safeParse(raw);const rowNumber=index+2;if(!result.success){errors.push({rowNumber,message:"Zorunlu alanlar veya uzunluklar geçersiz."});return;}const school=schoolMap.get(normalizeSchoolName(result.data.school));if(!school){errors.push({rowNumber,message:"Aktif okul bulunamadı."});return;}const key=`${result.data.firstName}|${result.data.lastName}|${school.id}|${result.data.phone}`.toLocaleLowerCase("tr-TR");if(seen.has(key)){errors.push({rowNumber,message:"Dosya içinde mükerrer kayıt."});return;}seen.add(key);rows.push({...result.data,school:school.name,schoolId:school.id,rowNumber});});
  if(errors.length)return{ok:false,message:"Hatalı satırlar düzeltilmeden içe aktarma yapılamaz.",errors};
  const existing=await prisma.vrRecord.findMany({where:{OR:rows.map(row=>({firstName:row.firstName,lastName:row.lastName,schoolId:row.schoolId,phone:row.phone||null}))},select:{firstName:true,lastName:true,schoolId:true,phone:true}});
  const existingKeys=new Set(existing.map(row=>`${row.firstName}|${row.lastName}|${row.schoolId}|${row.phone??""}`.toLocaleLowerCase("tr-TR")));for(const row of rows){const key=`${row.firstName}|${row.lastName}|${row.schoolId}|${row.phone}`.toLocaleLowerCase("tr-TR");if(existingKeys.has(key))errors.push({rowNumber:row.rowNumber,message:"Bu kayıt sistemde zaten mevcut."});}
  if(errors.length)return{ok:false,message:"Mükerrer kayıtlar içe aktarılamaz.",errors};
  if(commit)await prisma.vrRecord.createMany({data:rows.map(row=>({firstName:row.firstName,lastName:row.lastName,school:row.school,schoolId:row.schoolId,phone:row.phone||null,createdByUserId:admin.id}))});
  return{ok:true,preview:!commit,validCount:rows.length,rows:rows.slice(0,100).map(({rowNumber,firstName,lastName,school})=>({rowNumber,firstName,lastName,school}))};
}
