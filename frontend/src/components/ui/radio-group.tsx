"use client";

import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/**
 * shadcn/ui RadioGroup: arrow keys move the choice, as in a native radio group. An item with children draws
 * them instead of the round dot (the review form's star boxes).
 */
export function RadioGroup({ className, ...props }: ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return <RadioGroupPrimitive.Root className={cn("grid gap-3", className)} {...props} />;
}

export function RadioGroupItem({ className, children, ...props }: ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      className={cn(
        children
          ? "disabled:opacity-50"
          : "grid size-5 shrink-0 place-content-center rounded-full border disabled:opacity-50 data-[state=checked]:border-primary",
        className,
      )}
      {...props}
    >
      {children ?? (
        <RadioGroupPrimitive.Indicator>
          <span className="block size-2.5 rounded-full bg-primary" />
        </RadioGroupPrimitive.Indicator>
      )}
    </RadioGroupPrimitive.Item>
  );
}
