import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border border-border px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground",
  {
    variants: {
      variant: {
        default: "bg-muted/40",
        success: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
        warning: "bg-amber-500/10 text-amber-600 border-amber-500/20",
        danger: "bg-destructive/10 text-destructive border-destructive/20",
        info: "bg-sky-500/10 text-sky-600 border-sky-500/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
