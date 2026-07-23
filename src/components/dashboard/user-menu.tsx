"use client";

import { ChevronDown, LogOut, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logout } from "@/features/auth/actions/auth-actions";

export function UserMenu({
  fullName,
  email,
  role,
}: {
  fullName: string;
  email: string;
  role: "ADMIN" | "STAFF";
}) {
  const roleLabel = role === "ADMIN" ? "Yetkili" : "Standart Kullanıcı";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-11 max-w-[13rem] gap-2 border border-transparent px-2 hover:border-border hover:bg-card sm:max-w-none" aria-label="Kullanıcı menüsünü aç">
          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-secondary text-secondary-foreground">
            <UserRound aria-hidden="true" className="size-4" />
          </span>
          <span className="hidden max-w-40 text-left sm:block">
            <span className="block truncate text-sm font-medium">{fullName}</span>
            <span className="block text-xs font-normal text-muted-foreground">{roleLabel}</span>
          </span>
          <ChevronDown aria-hidden="true" className="size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate font-medium">{fullName}</span>
          <span className="block truncate text-xs text-muted-foreground">{email}</span>
          <span className="mt-1 block text-xs text-muted-foreground">{roleLabel}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <form action={logout}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full">
              <LogOut aria-hidden="true" />
              Çıkış Yap
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
