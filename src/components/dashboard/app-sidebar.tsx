import { DashboardNavigation } from "@/components/dashboard/dashboard-navigation";
import type { DashboardRole } from "@/components/dashboard/navigation";

export function AppSidebar({ role }: { role: DashboardRole }) {
  return (
    <aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-background lg:flex lg:flex-col">
      <div className="flex h-16 items-center border-b px-6">
        <div>
          <p className="text-lg font-semibold">LeadBridge</p>
          <p className="text-xs text-muted-foreground">Öğrenci dönüşüm sistemi</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-5">
        <DashboardNavigation role={role} />
      </div>
      <div className="border-t px-6 py-4 text-xs leading-5 text-muted-foreground">
        Etkinlik ve dönüşüm operasyonları
      </div>
    </aside>
  );
}
