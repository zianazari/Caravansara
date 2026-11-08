"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

/**
 * Time left to pay (FR-026, research R12). It ticks every second for the eye, but a screen reader hears it
 * only at 5 minutes, 1 minute and the end, because announcing every second would make the page unusable.
 * At zero it calls `onExpire`; the API's `hold_expired` stays the final word.
 */
export function HoldCountdown({
  remainingAt,
  onExpire,
}: {
  remainingAt: () => number;
  onExpire: () => void;
}) {
  const t = useTranslations("booking");
  const locale = useLocale();
  const [left, setLeft] = useState(remainingAt);
  const [announced, setAnnounced] = useState("");
  const spoken = useRef(new Set<number>());
  const expired = useRef(false);

  useEffect(() => {
    const tick = () => {
      const ms = remainingAt();
      setLeft(ms);
      const minutes = Math.ceil(ms / 60_000);
      for (const mark of [5, 1]) {
        if (minutes <= mark && ms > 0 && !spoken.current.has(mark)) {
          spoken.current.add(mark);
          setAnnounced(t("minutesLeft", { minutes: mark }));
        }
      }
      if (ms <= 0 && !expired.current) {
        expired.current = true;
        setAnnounced(t("holdEnded"));
        onExpire();
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [remainingAt, onExpire, t]);

  const seconds = Math.ceil(left / 1000);
  const clock = new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en", { minimumIntegerDigits: 2 });
  const time = `${clock.format(Math.floor(seconds / 60))}:${clock.format(seconds % 60)}`;
  return (
    <div className="rounded-lg bg-accent p-3">
      <p className="font-semibold tabular-nums" aria-hidden={true}>
        {left > 0 ? t("timeLeft", { time }) : t("holdEnded")}
      </p>
      <p className="sr-only" role="status" aria-live="polite">
        {announced}
      </p>
    </div>
  );
}
