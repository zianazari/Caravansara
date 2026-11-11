import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/** A placeholder while content loads; a light band runs across it (feature 031) instead of a blink. */
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-shimmer rounded-lg bg-[linear-gradient(90deg,var(--muted)_0%,var(--surface)_50%,var(--muted)_100%)] bg-[length:200%_100%]",
        className,
      )}
      {...props}
    />
  );
}
