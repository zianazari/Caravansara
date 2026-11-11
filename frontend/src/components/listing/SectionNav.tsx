"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

const SECTIONS = [
  { id: "photos", key: "photos" },
  { id: "amenities", key: "amenities" },
  { id: "reviews", key: "reviews" },
  { id: "location", key: "location" },
] as const;

/**
 * Jump links to the page's main sections (feature 032), pinned under the header once the photos have
 * scrolled away, like a room page on a booking site. The section in view is marked, so the bar also tells
 * the visitor where they are. It sits right under the header, which is 60 px tall from md up. Plain anchors: they work without JavaScript and with the back button.
 */
export function SectionNav() {
  const t = useTranslations("listing");
  const [shown, setShown] = useState(false);
  const [active, setActive] = useState<string>("photos");

  useEffect(() => {
    const photos = document.getElementById("photos");
    // Without IntersectionObserver (an old browser) the bar stays hidden; the page works the same.
    if (!photos || typeof IntersectionObserver === "undefined") return;
    const past = new IntersectionObserver(([entry]) => setShown(!entry!.isIntersecting), { threshold: 0 });
    past.observe(photos);
    const inView = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) setActive(entry.target.id);
      },
      { rootMargin: "-30% 0px -60% 0px" },
    );
    for (const { id } of SECTIONS) {
      const el = document.getElementById(id);
      if (el) inView.observe(el);
    }
    return () => {
      past.disconnect();
      inView.disconnect();
    };
  }, []);

  return (
    <nav
      aria-label={t("sections")}
      className={cn(
        // Fixed, not sticky: a hidden bar takes no room, so it leaves no gap under the photos (feature 034).
        "fixed inset-x-0 top-[60px] z-30 hidden border-b bg-background/95 backdrop-blur transition-[opacity,transform] duration-300 md:block",
        shown ? "opacity-100" : "pointer-events-none -translate-y-2 opacity-0",
      )}
    >
      <ul className="mx-auto flex max-w-[calc(72rem+3rem)] gap-6 px-6">
        {SECTIONS.map(({ id, key }) => (
          <li key={id}>
            <a
              href={`#${id}`}
              tabIndex={shown ? undefined : -1}
              aria-current={active === id ? "true" : undefined}
              className={cn(
                "inline-block border-b-2 py-3 text-sm font-semibold transition-colors",
                active === id
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
              )}
            >
              {t(key === "location" ? "where" : key)}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
