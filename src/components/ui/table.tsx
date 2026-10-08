import * as React from "react";
import { cn } from "@/lib/utils";

type TableProps = React.HTMLAttributes<HTMLTableElement>;

function Table({ className, ...props }: TableProps) {
  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-black/[0.08] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
      <table className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  );
}

type TableHeaderProps = React.HTMLAttributes<HTMLTableSectionElement>;

function TableHeader({ className, ...props }: TableHeaderProps) {
  return <thead className={cn("bg-[#FAFAFC] border-b border-black/[0.06]", className)} {...props} />;
}

type TableBodyProps = React.HTMLAttributes<HTMLTableSectionElement>;

function TableBody({ className, ...props }: TableBodyProps) {
  return <tbody className={cn("[&_tr:last-child]:border-0 divide-y divide-black/[0.04]", className)} {...props} />;
}

type TableRowProps = React.HTMLAttributes<HTMLTableRowElement>;

function TableRow({ className, ...props }: TableRowProps) {
  return (
    <tr
      className={cn(
        "transition-colors hover:bg-[#F5F5F7]/70 data-[state=selected]:bg-[#0071E3]/5",
        className
      )}
      {...props}
    />
  );
}

type TableHeadProps = React.ThHTMLAttributes<HTMLTableCellElement>;

function TableHead({ className, ...props }: TableHeadProps) {
  return (
    <th
      className={cn(
        "h-11 px-4 text-left align-middle text-xs font-medium uppercase tracking-wider text-[#86868B] [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  );
}

type TableCellProps = React.TdHTMLAttributes<HTMLTableCellElement>;

function TableCell({ className, ...props }: TableCellProps) {
  return (
    <td
      className={cn("px-4 py-3.5 align-middle text-sm text-[#1D1D1F] [&:has([role=checkbox])]:pr-0", className)}
      {...props}
    />
  );
}

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
