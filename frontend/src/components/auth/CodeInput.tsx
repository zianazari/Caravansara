"use client";

import { useImperativeHandle, useLayoutEffect, useRef, useState, type ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { toLatinDigits } from "@/lib/digits";

const LENGTH = 5;
type Props = Pick<
  ComponentProps<"input">,
  "id" | "ref" | "aria-label" | "aria-invalid" | "aria-describedby" | "disabled"
> & {
  value: string;
  onChange: (value: string) => void;
};

/** Five visual slots, one native control for keyboard editing, screen readers and email autofill. */
export function CodeInput({ value, onChange, ref, disabled, ...props }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const pendingCaret = useRef<number | null>(null);
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  useImperativeHandle(ref, () => input.current!, []);

  useLayoutEffect(() => {
    if (pendingCaret.current !== null && input.current) {
      input.current.setSelectionRange(pendingCaret.current, Math.min(pendingCaret.current + 1, value.length));
      pendingCaret.current = null;
    }
  }, [value, active]);

  function change(raw: string, caret: number) {
    const next = toLatinDigits(raw)
      .replace(/[^0-9]/g, "")
      .slice(0, LENGTH);
    const position = Math.min(toLatinDigits(raw.slice(0, caret)).replace(/[^0-9]/g, "").length, next.length);
    pendingCaret.current = position;
    setActive(position);
    onChange(next);
  }

  return (
    <div
      className="relative mx-auto w-full max-w-[21rem]"
      dir="ltr"
      onClick={(event) => {
        if (disabled) return;
        const slot = (event.target as HTMLElement).closest<HTMLElement>("[data-code-slot]");
        const bounds = event.currentTarget.getBoundingClientRect();
        const clicked = slot
          ? Number(slot.dataset.codeSlot)
          : bounds.width
            ? Math.floor(((event.clientX - bounds.left) / bounds.width) * LENGTH)
            : value.length;
        const position = Math.min(Math.max(0, clicked), value.length);
        pendingCaret.current = null;
        input.current?.focus();
        input.current?.setSelectionRange(position, Math.min(position + 1, value.length));
        setActive(position);
      }}
    >
      <input
        {...props}
        ref={input}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        autoCapitalize="none"
        spellCheck={false}
        dir="ltr"
        maxLength={12}
        value={value}
        disabled={disabled}
        className="absolute inset-0 z-10 h-full w-full opacity-0"
        onFocus={() => {
          setFocused(true);
          setActive(input.current?.selectionStart ?? value.length);
        }}
        onBlur={() => setFocused(false)}
        onSelect={(event) => setActive(event.currentTarget.selectionStart ?? value.length)}
        onKeyUp={(event) => setActive(event.currentTarget.selectionStart ?? value.length)}
        onKeyDown={(event) => {
          if (event.altKey || event.ctrlKey || event.metaKey) return;
          const start = event.currentTarget.selectionStart ?? value.length;
          const targets: Record<string, number> = {
            ArrowLeft: Math.max(0, start - 1),
            ArrowRight: Math.min(value.length, start + 1),
            Home: 0,
            End: value.length,
          };
          const position = targets[event.key];
          if (position === undefined) return;
          event.preventDefault();
          pendingCaret.current = null;
          event.currentTarget.setSelectionRange(position, Math.min(position + 1, value.length));
          setActive(position);
        }}
        onChange={(event) =>
          change(
            event.currentTarget.value,
            event.currentTarget.selectionStart ?? event.currentTarget.value.length,
          )
        }
        onPaste={(event) => {
          const digits = toLatinDigits(event.clipboardData.getData("text")).replace(/[^0-9]/g, "");
          if (!digits) return;
          event.preventDefault();
          if (digits.length >= LENGTH) change(digits, LENGTH);
          else {
            const start = event.currentTarget.selectionStart ?? value.length;
            const end = Math.max(
              event.currentTarget.selectionEnd ?? start,
              Math.min(value.length, start + digits.length),
            );
            change(value.slice(0, start) + digits + value.slice(end), start + digits.length);
          }
        }}
      />
      <div aria-hidden="true" className="grid grid-cols-5 gap-2 sm:gap-3">
        {Array.from({ length: LENGTH }, (_, index) => {
          const selected = focused && Math.min(active, LENGTH - 1) === index;
          return (
            <span
              key={index}
              data-code-slot={index}
              data-active={selected || undefined}
              className={cn(
                "relative grid h-[72px] cursor-text place-items-center rounded-xl border bg-background text-[2.5rem] leading-none font-semibold text-foreground tabular-nums transition-[border-color,box-shadow]",
                props["aria-invalid"] && "border-destructive",
                selected && "border-primary ring-2 ring-primary/35",
                disabled && "cursor-not-allowed opacity-50",
              )}
            >
              {value[index] ?? ""}
              {selected && !value[index] ? (
                <span className="absolute h-8 w-0.5 animate-pulse bg-primary motion-reduce:animate-none" />
              ) : null}
            </span>
          );
        })}
      </div>
    </div>
  );
}
