import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/**
 * shadcn/ui Button. Since feature 031 every button answers the pointer: it rises a little with a soft shadow
 * and presses in when clicked (all off under prefers-reduced-motion). `soft` is a sand pill for the small
 * actions that used to be underlined words ("clear dates", "write a review", "back to the queue"), so every
 * clickable thing on the site looks like a button. `link` is drawn the same way, so no action stays plain text.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-[transform,box-shadow,background-color,color,opacity] duration-200 ease-(--ease-soft) hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:shadow-md",
        outline: "border bg-card hover:bg-muted hover:shadow-sm",
        ghost: "hover:bg-muted",
        destructive: "bg-destructive text-primary-foreground hover:bg-destructive/90 hover:shadow-md",
        soft: "rounded-full bg-muted font-semibold text-primary hover:bg-sand-strong/40 hover:shadow-sm",
        link: "rounded-full bg-muted font-semibold text-primary hover:bg-sand-strong/40 hover:shadow-sm",
      },
      size: { default: "h-11 px-4", sm: "h-9 px-3", lg: "h-12 px-6 text-base", icon: "size-11" },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Component = asChild ? Slot.Root : "button";
  return <Component className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
