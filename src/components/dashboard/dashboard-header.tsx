import { MobileSidebar } from "@/components/dashboard/mobile-sidebar";
import type { DashboardRole } from "@/components/dashboard/navigation";
import { UserMenu } from "@/components/dashboard/user-menu";

export function DashboardHeader({
  user,
}: {
  user: { fullName: string; email: string; role: DashboardRole };
}) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <MobileSidebar role={user.role} />
        <div className="lg:hidden">
          <p className="font-semibold">LeadBridge</p>
          <p className="hidden text-xs text-muted-foreground sm:block">Öğrenci dönüşüm sistemi</p>
        </div>
      </div>
      <UserMenu {...user} />
    </header>
  );
}
