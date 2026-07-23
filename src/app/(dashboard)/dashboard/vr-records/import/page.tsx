import { FileUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/page-header";
import { requireAdmin } from "@/features/auth/server/auth";
import { VrImportForm } from "@/features/vr-records/components/vr-import-form";
export default async function VrImportPage(){await requireAdmin();return <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6"><PageHeader icon={FileUp} title="VR CSV İçe Aktarma" description="Dosyayı önce doğrulayın, ardından tek adımda güvenli biçimde içe aktarın."/><Card className="mt-8 p-5 sm:p-6"><VrImportForm/></Card></main>;}
