import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/** shadcn/ui Textarea, styled like Input. */
export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full min-w-0 rounded-lg border bg-card px-3 py-2 text-base aria-invalid:border-destructive disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
