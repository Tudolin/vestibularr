import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control font-display text-[0.95rem] font-semibold tracking-[0.01em] transition-[background-color,color,opacity,transform,box-shadow] duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // botão principal no estilo da marca: "degrau" embaixo que afunda ao tocar
        primary: "bg-primary text-primary-foreground shadow-[0_3px_0_var(--primary-shadow)] hover:opacity-90 active:translate-y-[2px] active:shadow-[0_1px_0_var(--primary-shadow)]",
        soft: "bg-primary-soft text-primary-soft-foreground hover:opacity-80",
        outline: "border border-input bg-card text-foreground hover:bg-muted",
        ghost: "text-foreground hover:bg-muted",
        danger: "bg-danger text-white hover:opacity-90 dark:text-[#0d0c22]",
      },
      size: {
        md: "h-11 px-4",
        sm: "h-10 px-3",
        lg: "h-12 px-6 text-base",
        icon: "size-11",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
  },
);
Button.displayName = "Button";
