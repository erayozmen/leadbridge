"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/features/auth/server/auth";
import { importVrRecords } from "@/features/vr-records/services/import-vr-records";

export async function importVrRecordsAction(formData:FormData){await requireAdmin();const file=formData.get("file");if(!(file instanceof File))return{ok:false as const,message:"CSV dosyası seçin.",errors:[]};const result=await importVrRecords(file,formData.get("commit")==="true");if(result.ok&&!result.preview)revalidatePath("/dashboard/vr-records");return result;}
