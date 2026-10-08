import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-tight transition-colors focus:outline-none",
  {
    variants: {
      variant: {
        default: "border-[#0071E3]/20 bg-[#0071E3]/10 text-[#0071E3]",
        secondary: "border-black/[0.06] bg-[#F5F5F7] text-[#6E6E73]",
        destructive: "border-[#FF3B30]/20 bg-[#FEECEC] text-[#D70015]",
        outline: "border-black/15 bg-white text-[#1D1D1F]",
        success: "border-[#34C759]/25 bg-[#EAF8EE] text-[#1B873F]",
        warning: "border-[#FF9500]/25 bg-[#FFF8E6] text-[#B25E00]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
