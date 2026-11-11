"use client";

import { useTranslations } from "next-intl";
import { useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * A long text cut to a few lines with a "show more" button (feature 032): the host's description and long
 * reviews. The button appears only when something is really cut off.
 */
export function ShowMoreText({ text, lines = 6 }: { text: string; lines?: number }) {
  const t = useTranslations("listing");
  const box = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [cut, setCut] = useState(false);
  useLayoutEffect(() => {
    const el = box.current;
    if (el && !open) setCut(el.scrollHeight > el.clientHeight + 1);
  }, [text, open]);
  return (
    <div className="grid justify-items-start gap-3">
      <p
        ref={box}
        className="whitespace-pre-line"
        style={
          open
            ? undefined
            : {
                display: "-webkit-box",
                WebkitLineClamp: lines,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }
        }
      >
        {text}
      </p>
      {cut || open ? (
        <Button variant="soft" size="sm" aria-expanded={open} onClick={() => setOpen(!open)}>
          {t(open ? "showLess" : "showMore")}
        </Button>
      ) : null}
    </div>
  );
}
