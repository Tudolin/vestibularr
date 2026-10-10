import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control text-sm font-semibold transition-[background-color,color,opacity,transform,box-shadow] duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:opacity-90",
        soft: "bg-primary-soft text-primary-soft-foreground hover:opacity-80",
        outline: "border border-input bg-card text-foreground hover:bg-muted",
        ghost: "text-foreground hover:bg-muted",
        danger: "bg-danger text-white hover:opacity-90 dark:text-[#0d0d1a]",
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
