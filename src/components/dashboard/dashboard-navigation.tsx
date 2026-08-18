"use client";

import {
  BarChart3,
  BookOpenCheck,
  ClipboardCheck,
  Gauge,
  QrCode,
  Search,
  Users,
  Video,
  type LucideIcon,
  CalendarDays,
  Bell,
  CircleDollarSign,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, type MouseEvent } from "react";

import {
  getDashboardNavigation,
  type DashboardNavItem,
  type DashboardRole,
} from "@/components/dashboard/navigation";
import { cn } from "@/lib/utils";

const icons: Record<DashboardNavItem["icon"], LucideIcon> = {
  overview: Gauge,
  students: Search,
  vr: Video,
  qr: QrCode,
  attendance: ClipboardCheck,
  course: BookOpenCheck,
  reports: BarChart3,
  users: Users,
  events: CalendarDays,
  notifications: Bell,
  commissions: CircleDollarSign,
};

type NavigationClick = Pick<
  MouseEvent<HTMLAnchorElement>,
  "altKey" | "button" | "ctrlKey" | "defaultPrevented" | "metaKey" | "shiftKey"
>;

export function handleNavigationClick(
  event: NavigationClick,
  onNavigate?: () => void,
) {
  if (
    !onNavigate
    || event.defaultPrevented
    || event.button !== 0
    || event.altKey
    || event.ctrlKey
    || event.metaKey
    || event.shiftKey
  ) {
    return;
  }

  onNavigate();
}

export function DashboardNavigation({
  role,
  compact = false,
  onNavigate,
}: {
  role: DashboardRole;
  compact?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const groupLabels = role === "ADMIN"
    ? new Map([[0, "Etkinlik"], [1, "Operasyon"], [9, "Yönetim ve raporlama"]])
    : new Map([[0, "Operasyon"]]);

  return (
    <nav aria-label="Ana menü" className={cn("space-y-1", compact && "px-2")}>
      {getDashboardNavigation(role).map((item, index) => {
        const Icon = icons[item.icon];
        const content = (
          <>
            <Icon aria-hidden="true" className="size-4" />
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {item.comingSoon ? (
              <span className="text-[10px] font-medium text-muted-foreground">Yakında</span>
            ) : null}
          </>
        );

        const isActive = item.href === pathname;

        return (
          <Fragment key={item.label}>
            {groupLabels.has(index) ? (
              <p className="px-3 pb-1 pt-3 text-[10px] font-semibold text-sidebar-foreground/45 uppercase">
                {groupLabels.get(index)}
              </p>
            ) : null}
            {item.href ? (
          <Link
            href={item.href}
            onClick={(event) => handleNavigationClick(event, onNavigate)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "relative flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-[background-color,color,box-shadow,transform] duration-200 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
              isActive
                ? "bg-white/12 text-white shadow-[inset_0_1px_rgb(255_255_255/0.08),0_6px_18px_rgb(3_20_35/0.2)] before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-emerald-300"
                : "text-sidebar-foreground/64 hover:translate-x-0.5 hover:bg-white/7 hover:text-white",
            )}
          >
            {content}
          </Link>
        ) : (
          <div
            aria-disabled="true"
            className="flex min-h-11 cursor-not-allowed items-center gap-3 rounded-md px-3 text-sm text-muted-foreground"
          >
            {content}
          </div>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
