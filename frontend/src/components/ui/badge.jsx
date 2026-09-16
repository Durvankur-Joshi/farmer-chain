import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-emerald-600 text-white shadow-2xs",
        secondary:
          "border-slate-200 bg-slate-100 text-slate-700",
        destructive:
          "border-rose-200 bg-rose-50 text-rose-700",
        outline:
          "border-slate-200 text-slate-700",
        success:
          "border-emerald-200 bg-emerald-50 text-emerald-800 font-bold",
        purple:
          "border-purple-200 bg-purple-50 text-purple-700 font-bold",
        amber:
          "border-amber-200 bg-amber-50 text-amber-700 font-bold",
        blue:
          "border-blue-200 bg-blue-50 text-blue-700 font-bold",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Badge({ className, variant, ...props }) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
