"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { SearchForm } from "@/components/search/SearchForm";

/** The same mounted form follows the visitor, so changing its size never loses their selections. */
export function HomeSearch({ today }: { today: string }) {
  const t = useTranslations("home");
  const anchor = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(69);
  const [height, setHeight] = useState<number>();

  useEffect(() => {
    const header = document.querySelector("header");
    if (!header) return;
    const measure = () => setHeaderHeight(header.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = anchor.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        setCompact(entry.boundingClientRect.top < headerHeight && !entry.isIntersecting);
      },
      { rootMargin: `-${headerHeight}px 0px 0px 0px`, threshold: 0 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [headerHeight]);

  useEffect(() => {
    if (compact || !content.current) return;
    const element = content.current;
    const measure = () => setHeight(element.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [compact]);

  return (
    <div
      ref={anchor}
      className="boutique-search relative z-30 mx-auto -mt-9 w-full max-w-5xl px-4 md:-mt-12 md:px-8"
      style={compact ? { height } : undefined}
    >
      <div
        ref={content}
        data-home-search
        data-compact={compact}
        className={
          compact
            ? "fixed inset-x-0 z-30 border-b bg-background/95 px-4 py-2 shadow-sm backdrop-blur-md"
            : undefined
        }
        style={compact ? { top: headerHeight } : undefined}
      >
        <div className={compact ? "mx-auto w-full max-w-2xl" : undefined}>
          <SearchForm today={today} />
        </div>
        {!compact ? (
          <p className="mt-4 text-center text-xs text-muted-foreground">{t("searchHint")}</p>
        ) : null}
      </div>
    </div>
  );
}
