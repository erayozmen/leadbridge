import { Badge } from "@/components/ui/badge";
import type { HealthStatus } from "../domain";

const variants = { HEALTHY: "success", WARNING: "warning", DEGRADED: "warning", FAILED: "destructive", UNKNOWN: "outline" } as const;
const labels = { HEALTHY: "Sağlıklı", WARNING: "Uyarı", DEGRADED: "Bozulmuş", FAILED: "Başarısız", UNKNOWN: "Bilinmiyor" } as const;
export function HealthStatusBadge({ status }: { status: HealthStatus }) {
  return <Badge variant={variants[status]}><span aria-hidden="true" className="size-1.5 rounded-full bg-current" />{labels[status]}</Badge>;
}
