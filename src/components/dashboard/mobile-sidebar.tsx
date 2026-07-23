"use client";

import { Menu } from "lucide-react";
import { useState } from "react";

import { DashboardNavigation } from "@/components/dashboard/dashboard-navigation";
import type { DashboardRole } from "@/components/dashboard/navigation";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function MobileSidebar({ role }: { role: DashboardRole }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Menüyü aç">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[min(19rem,88vw)] gap-0 bg-sidebar p-0 text-sidebar-foreground" showCloseButton>
        <SheetHeader className="border-b border-sidebar-border px-5 py-5 text-left">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-md bg-primary text-sm font-bold text-primary-foreground">LB</span>
            <div>
              <SheetTitle>LeadBridge</SheetTitle>
              <SheetDescription>Operasyon merkezi</SheetDescription>
            </div>
          </div>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto py-4">
          <DashboardNavigation
            role={role}
            compact
            onNavigate={() => setOpen(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
