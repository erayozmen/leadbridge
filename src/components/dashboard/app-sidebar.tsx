import { DashboardNavigation } from "@/components/dashboard/dashboard-navigation";
import type { DashboardRole } from "@/components/dashboard/navigation";

export function AppSidebar({ role }: { role: DashboardRole }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-68 border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex lg:flex-col">
      <div className="flex h-18 items-center border-b border-sidebar-border px-5">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            LB
          </span>
          <div>
            <p className="text-base font-semibold">LeadBridge</p>
            <p className="text-xs text-muted-foreground">Operasyon merkezi</p>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <DashboardNavigation role={role} />
      </div>
      <div className="border-t border-sidebar-border px-5 py-4 text-xs leading-5 text-muted-foreground">
        Öğrenci dönüşüm ve etkinlik takibi
      </div>
    </aside>
  );
}
