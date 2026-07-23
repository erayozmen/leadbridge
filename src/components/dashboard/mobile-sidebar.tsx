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
      <SheetContent side="left" className="w-72 p-0" showCloseButton>
        <SheetHeader className="border-b px-5 py-5 text-left">
          <SheetTitle>LeadBridge</SheetTitle>
          <SheetDescription>Öğrenci Dönüşüm ve Etkinlik Takip Sistemi</SheetDescription>
        </SheetHeader>
        <div className="overflow-y-auto py-4">
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
