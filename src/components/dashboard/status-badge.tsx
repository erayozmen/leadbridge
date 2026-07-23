import { Badge } from "@/components/ui/badge";

const labels: Record<string, string> = {
  ACTIVE: "Aktif",
  INACTIVE: "Pasif",
  ADMIN: "Yönetici",
  STAFF: "Personel",
  DRAFT: "Taslak",
  COMPLETED: "Tamamlandı",
  ARCHIVED: "Arşivlendi",
  CREATED: "Oluşturuldu",
  ASSIGNED: "Atandı",
  USED: "Kullanıldı",
  DISABLED: "Devre dışı",
  MATCHED: "Eşleşti",
  UNMATCHED: "Eşleşmedi",
  ATTENDED: "Katıldı",
  NOT_ATTENDED: "Katılmadı",
  ENROLLED: "Kursa kayıtlı",
  NOT_ENROLLED: "Kayıtlı değil",
};

const variants = {
  ACTIVE: "success",
  ASSIGNED: "info",
  MATCHED: "success",
  ATTENDED: "success",
  ENROLLED: "success",
  DRAFT: "warning",
  CREATED: "outline",
  COMPLETED: "info",
  ARCHIVED: "secondary",
  INACTIVE: "outline",
  DISABLED: "destructive",
  USED: "secondary",
  UNMATCHED: "outline",
  NOT_ATTENDED: "outline",
  NOT_ENROLLED: "outline",
  ADMIN: "default",
  STAFF: "secondary",
} as const;

export function StatusBadge({ status }: { status: string }) {
  const variant = variants[status as keyof typeof variants] ?? "outline";
  return (
    <Badge variant={variant}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current opacity-70" />
      {labels[status] ?? status}
    </Badge>
  );
}
