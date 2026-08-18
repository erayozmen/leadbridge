import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  eyebrow,
  icon: Icon,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  icon?: LucideIcon;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "relative flex flex-col gap-4 overflow-hidden rounded-lg border border-white/80 bg-card/90 p-5 shadow-[0_1px_2px_rgb(15_23_42/0.04),0_16px_34px_rgb(15_23_42/0.04)] sm:flex-row sm:items-center sm:justify-between sm:p-6",
        className,
      )}
    >
      <div aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-primary" />
      <div className="flex min-w-0 max-w-3xl items-start gap-4">
        {Icon ? (
          <span className="grid size-11 shrink-0 place-items-center rounded-md border border-primary/15 bg-secondary text-primary shadow-sm">
            <Icon className="size-5" />
          </span>
        ) : null}
        <div className="min-w-0">
          {eyebrow ? <div className="mb-3">{eyebrow}</div> : null}
          <h1 className="text-2xl font-semibold text-balance sm:text-3xl">{title}</h1>
          {description ? (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="flex w-full min-w-0 flex-wrap gap-2 [&>*]:max-w-full sm:w-auto sm:shrink-0 sm:justify-end">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
