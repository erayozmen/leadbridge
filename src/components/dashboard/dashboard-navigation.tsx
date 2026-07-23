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
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MouseEvent } from "react";

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

  return (
    <nav aria-label="Ana menü" className={cn("space-y-1", compact && "px-2")}>
      {getDashboardNavigation(role).map((item) => {
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

        return item.href ? (
          <Link
            key={item.label}
            href={item.href}
            onClick={(event) => handleNavigationClick(event, onNavigate)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "relative flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-primary"
                : "text-muted-foreground hover:bg-sidebar-accent/65 hover:text-sidebar-foreground",
            )}
          >
            {content}
          </Link>
        ) : (
          <div
            key={item.label}
            aria-disabled="true"
            className="flex min-h-11 cursor-not-allowed items-center gap-3 rounded-md px-3 text-sm text-muted-foreground"
          >
            {content}
          </div>
        );
      })}
    </nav>
  );
}
