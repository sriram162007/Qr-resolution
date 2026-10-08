import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-xl border border-black/10 bg-white px-3.5 py-2 text-sm text-[#1D1D1F] shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all placeholder:text-[#86868B] focus:border-[#0071E3] focus:outline-none focus:ring-4 focus:ring-[#0071E3]/10 disabled:cursor-not-allowed disabled:bg-[#F5F5F7] disabled:opacity-60",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
