import { Card } from "@/components/ui/card";
import { requireAdmin } from "@/features/auth/server/auth";
import { VrImportForm } from "@/features/vr-records/components/vr-import-form";
export default async function VrImportPage(){await requireAdmin();return <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6"><h1 className="text-3xl font-semibold">VR CSV İçe Aktarma</h1><p className="mt-2 text-muted-foreground">Dosyayı önce doğrulayın, ardından tek adımda güvenli biçimde içe aktarın.</p><Card className="mt-8 p-5"><VrImportForm/></Card></main>;}
