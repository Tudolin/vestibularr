import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-card border border-border bg-card text-card-foreground shadow-sm dark:shadow-none", className)}
      {...props}
    />
  );
}
export const CardHeader = (p: React.ComponentProps<"div">) => (
  <div {...p} className={cn("flex flex-col gap-1 p-5 pb-3", p.className)} />
);
export const CardTitle = (p: React.ComponentProps<"h2">) => (
  <h2 {...p} className={cn("text-base font-bold leading-tight", p.className)} />
);
export const CardDescription = (p: React.ComponentProps<"p">) => (
  <p {...p} className={cn("text-sm text-muted-foreground", p.className)} />
);
export const CardContent = (p: React.ComponentProps<"div">) => (
  <div {...p} className={cn("p-5 pt-2", p.className)} />
);
