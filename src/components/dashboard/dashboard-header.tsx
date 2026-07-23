import { MobileSidebar } from "@/components/dashboard/mobile-sidebar";
import type { DashboardRole } from "@/components/dashboard/navigation";
import { UserMenu } from "@/components/dashboard/user-menu";

export function DashboardHeader({
  user,
}: {
  user: { fullName: string; email: string; role: DashboardRole };
}) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/90 px-3 shadow-[0_1px_0_0_rgb(15_23_42/0.02)] backdrop-blur-md sm:px-6 lg:h-18 lg:px-8">
      <div className="flex items-center gap-3">
        <MobileSidebar role={user.role} />
        <div className="min-w-0 lg:hidden">
          <p className="truncate font-semibold">LeadBridge</p>
          <p className="hidden text-xs text-muted-foreground sm:block">
            Öğrenci dönüşüm sistemi
          </p>
        </div>
      </div>
      <UserMenu {...user} />
    </header>
  );
}
