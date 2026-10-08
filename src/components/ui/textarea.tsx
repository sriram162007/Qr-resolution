import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  className?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[90px] w-full rounded-xl border border-black/10 bg-white p-3.5 text-sm text-[#1D1D1F] shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all placeholder:text-[#86868B] focus:border-[#0071E3] focus:outline-none focus:ring-4 focus:ring-[#0071E3]/10 disabled:cursor-not-allowed disabled:bg-[#F5F5F7] disabled:opacity-60",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
