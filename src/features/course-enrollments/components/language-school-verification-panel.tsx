import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { LanguageSchoolMatchStatus } from "@/features/course-enrollments/integrations/language-school-contract";
import { canRunLanguageSchoolLookup } from "@/features/course-enrollments/lib/language-school-selection";

export const canViewLanguageSchoolVerification = (role: "ADMIN" | "STAFF") => role === "ADMIN";
export const languageSchoolIntegrationAvailable = false;

export const languageSchoolResultLabels: Record<LanguageSchoolMatchStatus, string> = {
  FOUND: "Eşleşti",
  NOT_FOUND: "Eşleşmedi",
  AMBIGUOUS: "Belirsiz",
  ERROR: "Kontrol edilemedi",
};

export type LanguageSchoolResultView = {
  leadBridgeRegistrationId: string;
  studentName: string;
  matchStatus: LanguageSchoolMatchStatus;
};

type Props = {
  selectedCount: number;
  results: LanguageSchoolResultView[];
};

export function LanguageSchoolVerificationPanel({ selectedCount, results }: Props) {
  const canLookup = canRunLanguageSchoolLookup(
    selectedCount,
    languageSchoolIntegrationAvailable,
  );

  return (
    <Card className="mt-6 rounded-lg shadow-none">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Dil Okulu Sistem Doğrulaması</CardTitle>
            <CardDescription className="mt-2 max-w-2xl">
              LeadBridge&apos;deki uygun öğrencileri seçerek gelecekte dil okulu sisteminde toplu
              olarak doğrulayabilirsiniz.
            </CardDescription>
          </div>
          <Badge variant="outline">Bağlantı bekleniyor</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium" aria-live="polite">
            Seçili öğrenci: {selectedCount}/100
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button disabled={!canLookup} aria-describedby="language-school-disabled-reason">
              Dil Okulu Sisteminde Toplu Sorgula
            </Button>
            <Button disabled variant="outline">
              Eşleşenleri İncele
            </Button>
          </div>
        </div>
        <p id="language-school-disabled-reason" className="text-sm text-muted-foreground">
          Dil okulu bağlantısı henüz yapılandırılmadı.
        </p>
        <div className="rounded-md border border-dashed p-5">
          <h3 className="text-sm font-medium">Doğrulama sonuçları</h3>
          {results.length ? (
            <ul className="mt-3 divide-y">
              {results.map((result) => (
                <li
                  key={result.leadBridgeRegistrationId}
                  className="flex items-center justify-between gap-3 py-3 text-sm"
                >
                  <span>{result.studentName}</span>
                  <Badge variant={result.matchStatus === "FOUND" ? "default" : "secondary"}>
                    {languageSchoolResultLabels[result.matchStatus]}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Dil okulu bağlantısı kurulduktan ve ilk sorgu çalıştırıldıktan sonra sonuçlar burada
              görüntülenecektir.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
