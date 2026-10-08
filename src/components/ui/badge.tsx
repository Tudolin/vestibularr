import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", {
  variants: {
    tone: {
      neutral: "bg-muted text-muted-foreground",
      primary: "bg-primary-soft text-primary-soft-foreground",
      success: "bg-success-soft text-success-soft-foreground",
      danger: "bg-danger-soft text-danger-soft-foreground",
      warning: "bg-warning-soft text-warning-soft-foreground",
      linguagens: "bg-area-linguagens-soft text-area-linguagens-foreground",
      humanas: "bg-area-humanas-soft text-area-humanas-foreground",
      natureza: "bg-area-natureza-soft text-area-natureza-foreground",
      matematica: "bg-area-matematica-soft text-area-matematica-foreground",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;

export function Badge({ tone, className, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export const AREAS = {
  linguagens: { label: "Linguagens", tone: "linguagens" },
  humanas: { label: "Humanas", tone: "humanas" },
  natureza: { label: "Natureza", tone: "natureza" },
  matematica: { label: "Matemática", tone: "matematica" },
} as const satisfies Record<string, { label: string; tone: BadgeTone }>;

export function AreaBadge({ area }: { area: keyof typeof AREAS }) {
  return <Badge tone={AREAS[area].tone}>{AREAS[area].label}</Badge>;
}
