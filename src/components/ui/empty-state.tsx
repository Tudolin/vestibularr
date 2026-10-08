import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-3 rounded-card border border-dashed border-border p-8 text-center", className)}>
      {icon && <div className="flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground [&_svg]:size-7">{icon}</div>}
      <h2 className="text-lg font-bold">{title}</h2>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action}
    </div>
  );
}
