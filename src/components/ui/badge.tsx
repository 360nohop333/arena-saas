import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border-border bg-surface-muted text-muted-foreground",
        primary: "border-primary/25 bg-accent text-primary",
        success: "border-success/25 bg-success-soft text-success",
        warning: "border-warning/30 bg-warning-soft text-warning",
        danger: "border-danger/30 bg-danger-soft text-danger",
        info: "border-info/25 bg-info-soft text-info",
        outline: "border-border-strong bg-transparent text-foreground",
      },
      size: {
        sm: "px-1.5 py-0 text-[10px]",
        md: "text-xs",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  },
);

export function Badge({
  className,
  variant,
  size,
  ...props
}: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}
