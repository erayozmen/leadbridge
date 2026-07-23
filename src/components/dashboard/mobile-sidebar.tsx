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
      <SheetContent side="left" className="w-[min(19rem,88vw)] gap-0 overflow-hidden border-white/10 bg-sidebar p-0 text-sidebar-foreground" showCloseButton>
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgb(255_255_255/0.06)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.05)_1px,transparent_1px)] [background-size:32px_32px]" />
        <SheetHeader className="relative border-b border-white/8 px-5 py-5 text-left">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-md bg-emerald-300 text-sm font-bold text-emerald-950">LB</span>
            <div>
              <SheetTitle>LeadBridge</SheetTitle>
              <SheetDescription>Operasyon merkezi</SheetDescription>
            </div>
          </div>
        </SheetHeader>
        <div className="relative flex-1 overflow-y-auto py-3">
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
