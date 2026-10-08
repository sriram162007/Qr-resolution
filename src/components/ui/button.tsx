import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium tracking-tight transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3]/30 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 select-none",
  {
    variants: {
      variant: {
        default: "bg-[#0071E3] text-white shadow-[0_1px_2px_rgba(0,113,227,0.25)] hover:bg-[#0077ED] active:bg-[#0062C4]",
        destructive: "bg-[#FF3B30] text-white shadow-xs hover:bg-[#E03126] active:bg-[#C9251B]",
        outline: "border border-black/10 bg-white text-[#1D1D1F] shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:bg-[#F5F5F7] hover:border-black/15 active:bg-[#EDEDF0]",
        secondary: "bg-[#F5F5F7] text-[#1D1D1F] border border-black/[0.04] hover:bg-[#EBEBEF] active:bg-[#E2E2E6]",
        ghost: "hover:bg-black/[0.05] text-[#1D1D1F] active:bg-black/[0.08]",
        link: "text-[#0071E3] underline-offset-4 hover:underline p-0 h-auto active:opacity-80",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-11 rounded-xl px-6 text-sm font-semibold",
        icon: "h-10 w-10 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
