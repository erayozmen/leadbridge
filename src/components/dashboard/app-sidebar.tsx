import { DashboardNavigation } from "@/components/dashboard/dashboard-navigation";
import type { DashboardRole } from "@/components/dashboard/navigation";

export function AppSidebar({ role }: { role: DashboardRole }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-68 overflow-hidden border-r border-white/8 bg-sidebar text-sidebar-foreground shadow-[8px_0_32px_rgb(4_25_38/0.12)] lg:flex lg:flex-col">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgb(255_255_255/0.06)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.05)_1px,transparent_1px)] [background-size:32px_32px]" />
      <div className="relative flex h-18 items-center border-b border-white/8 px-5">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-md border border-emerald-200/25 bg-emerald-300 text-sm font-bold text-emerald-950 shadow-[0_0_24px_rgb(110_231_183/0.18)]">
            LB
          </span>
          <div>
            <p className="text-base font-semibold text-white">LeadBridge</p>
            <p className="text-xs text-sidebar-foreground/55">Operasyon merkezi</p>
          </div>
        </div>
      </div>
      <div className="relative flex-1 overflow-y-auto px-3 py-3">
        <DashboardNavigation role={role} />
      </div>
      <div className="relative border-t border-white/8 px-4 py-4">
        <div className="rounded-md border border-white/8 bg-white/5 px-3 py-3">
          <p className="text-xs font-semibold text-white">{role === "ADMIN" ? "Yönetici çalışma alanı" : "Operasyon çalışma alanı"}</p>
          <p className="mt-1 text-[11px] leading-4 text-sidebar-foreground/50">Öğrenci dönüşüm ve etkinlik takibi</p>
        </div>
      </div>
    </aside>
  );
}
