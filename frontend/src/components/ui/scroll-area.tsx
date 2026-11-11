"use client";

import { ScrollArea as ScrollAreaPrimitive } from "radix-ui";
import type { ComponentProps, Ref } from "react";
import { cn } from "@/lib/cn";

/**
 * shadcn/ui ScrollArea: a thin scroll bar in the theme's colours, the same in every browser. `viewportRef`
 * and `viewportClassName` reach the element that really scrolls (needed by rows with arrow buttons and
 * scroll-snap). Radix wraps the content in a `display: table` box; a horizontal row makes it a block, so its
 * children's percentage widths are measured against the visible width.
 */
export function ScrollArea({
  className,
  children,
  viewportRef,
  viewportClassName,
  orientation = "vertical",
  ...props
}: ComponentProps<typeof ScrollAreaPrimitive.Root> & {
  viewportRef?: Ref<HTMLDivElement>;
  viewportClassName?: string;
  orientation?: "vertical" | "horizontal";
}) {
  return (
    <ScrollAreaPrimitive.Root className={cn("relative overflow-hidden", className)} {...props}>
      <ScrollAreaPrimitive.Viewport
        ref={viewportRef}
        className={cn("size-full rounded-[inherit]", orientation === "horizontal" && "[&>div]:block!", viewportClassName)}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar orientation={orientation} />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}

export function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      orientation={orientation}
      className={cn(
        "flex touch-none p-px transition-colors select-none",
        orientation === "vertical" && "h-full w-2 border-s border-s-transparent",
        orientation === "horizontal" && "h-2 flex-col border-t border-t-transparent",
        className,
      )}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-sand-strong hover:bg-copper" />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  );
}
