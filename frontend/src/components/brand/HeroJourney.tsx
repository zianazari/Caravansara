"use client";

import { useLocale } from "next-intl";
import { useEffect, useRef } from "react";
import courtyard from "@/assets/hero-courtyard.jpg";
import { ROAD, journeyAt, mirror } from "@/lib/heroJourney";

/** Scroll distance, as a share of the hero's height, over which the whole trip plays. */
const TRIP_SHARE = 0.8;
/** How quickly the drawn car catches up with the scroll each frame: it rolls on a little after a scroll. */
const CATCH_UP = 0.1;
const GATE_X = 560;
const CITY_X = 905;

/**
 * The home page hero's story (feature 041, owner's request): a car with three passengers drives along a road
 * as the visitor scrolls down, stops at a caravansara (its gateway frames the owner's courtyard photo from the
 * README, feature 027), drives on and stops at a city. Scrolling up drives it back. While nobody scrolls, the
 * car idles in place with a slight bob (CSS, .hero-car-idle). On the Persian site the road runs from right to
 * left, the reading direction.
 *
 * The drawing is plain SVG in the theme's colours, so it is sharp at any size and adds no request but the
 * photo. Scroll is read once per frame with requestAnimationFrame, and the car is moved by setting SVG
 * attributes directly, so React does not re-render on every frame. Decoration only: hidden from screen
 * readers. Under prefers-reduced-motion the car is shown parked at the caravansara and nothing moves.
 */
export function HeroJourney() {
  const rtl = useLocale() === "fa";
  const svg = useRef<SVGSVGElement>(null);
  const car = useRef<SVGGElement>(null);
  const wheels = useRef<SVGGElement[]>([]);

  useEffect(() => {
    const scene = svg.current;
    const body = car.current;
    if (!scene || !body) return;
    const hero = scene.closest("section") ?? scene;
    // Without matchMedia (an old browser, or the test DOM) the visitor has not asked for less motion.
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let shown = reduced ? 0.42 : 0;
    let target = shown;
    let frame = 0;

    const place = (progress: number) => {
      const { x, parkedAt } = journeyAt(progress);
      const at = mirror(x, rtl);
      body.setAttribute("transform", `translate(${at} 0) scale(${rtl ? -1 : 1} 1)`);
      for (const wheel of wheels.current) wheel.setAttribute("transform", `rotate(${(x * 3.2) % 360})`);
      scene.dataset.parked = parkedAt === null ? "" : String(parkedAt);
      scene.dataset.moving = Math.abs(target - shown) > 0.002 ? "true" : "false";
    };
    const step = () => {
      shown += (target - shown) * CATCH_UP;
      if (Math.abs(target - shown) < 0.0005) shown = target;
      place(shown);
      frame = shown === target ? 0 : requestAnimationFrame(step);
    };
    const onScroll = () => {
      target = window.scrollY / Math.max(1, hero.getBoundingClientRect().height * TRIP_SHARE);
      if (!frame) frame = requestAnimationFrame(step);
    };

    place(shown);
    if (reduced) return;
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [rtl]);

  const wheelRef = (index: number) => (el: SVGGElement | null) => {
    if (el) wheels.current[index] = el;
  };

  return (
    <svg
      ref={svg}
      aria-hidden
      data-hero="scene"
      viewBox="0 0 1000 220"
      preserveAspectRatio="xMidYMax meet"
      overflow="visible"
      // Above the search pill, which rests on the hero's lower edge (-mt-8, md:-mt-10), so the road shows.
      className="hero-scene absolute inset-x-0 bottom-9 h-40 w-full md:bottom-12 md:h-52"
    >
      <defs>
        <clipPath id="hero-gate-arch">
          <path d="M-34 0V-58C-34 -80 -16 -94 0 -106C16 -94 34 -80 34 -58V0Z" />
        </clipPath>
      </defs>

      {/* Stars over the far hills. */}
      <g className="fill-gold">
        {[60, 210, 330, 470, 640, 760, 880].map((x, i) => (
          <circle key={x} cx={x} cy={70 + (i % 3) * 14} r={1.6} className="hero-star" />
        ))}
      </g>
      {/* Far hills, wider than the scene so wide screens show no edge. */}
      <path
        d="M-600 190 L-300 140 L-50 165 L150 120 L330 160 L520 128 L700 158 L880 118 L1100 160 L1600 140 L1600 190Z"
        className="fill-foreground opacity-60"
      />

      {/* The caravansara: a wide wall, two towers and a pointed gateway with the courtyard inside. */}
      <g transform={`translate(${mirror(GATE_X, rtl)} 186)`} className="hero-gate">
        <rect x={-110} y={-62} width={220} height={62} className="fill-sand-strong" />
        <rect x={-122} y={-84} width={24} height={84} className="fill-copper" />
        <rect x={98} y={-84} width={24} height={84} className="fill-copper" />
        <rect x={-46} y={-118} width={92} height={118} className="fill-copper" />
        <g clipPath="url(#hero-gate-arch)">
          <image
            href={courtyard.src}
            x={-60}
            y={-110}
            width={120}
            height={110}
            preserveAspectRatio="xMidYMid slice"
          />
        </g>
        <path
          d="M-34 0V-58C-34 -80 -16 -94 0 -106C16 -94 34 -80 34 -58V0"
          className="hero-gate-glow fill-none stroke-amber"
          strokeWidth={4}
        />
      </g>

      {/* The city: a few houses whose windows light up when the car arrives, and a pin above them. */}
      <g transform={`translate(${mirror(CITY_X, rtl)} 186)`} className="hero-city">
        {[
          { x: -70, w: 40, h: 70 },
          { x: -26, w: 34, h: 104 },
          { x: 12, w: 46, h: 82 },
          { x: 62, w: 30, h: 56 },
        ].map((b) => (
          <g key={b.x}>
            <rect x={b.x} y={-b.h} width={b.w} height={b.h} className="fill-muted-foreground" />
            {Array.from({ length: Math.floor(b.h / 22) }, (_, row) => (
              <rect
                key={row}
                x={b.x + 8}
                y={-b.h + 10 + row * 22}
                width={b.w - 16}
                height={8}
                rx={1.5}
                className="hero-window fill-night"
              />
            ))}
          </g>
        ))}
        <path
          d="M0 -146a14 14 0 0 0-14 14c0 11 14 24 14 24s14-13 14-24a14 14 0 0 0-14-14z"
          className="hero-pin fill-amber"
        />
        <circle cx={0} cy={-132} r={5} className="fill-night" />
      </g>

      {/* The road, longer than the scene, with a dashed middle line. */}
      <rect x={-600} y={186} width={2200} height={34} className="fill-foreground" />
      <line
        x1={-600}
        x2={1600}
        y1={203}
        y2={203}
        className="stroke-gold"
        strokeWidth={2}
        strokeDasharray="18 16"
      />

      {/* The car, drawn facing forward (+x); mirrored on the Persian site. */}
      <g ref={car} transform={`translate(${mirror(ROAD.start, rtl)} 0) scale(${rtl ? -1 : 1} 1)`}>
        <g className="hero-car-idle">
          <path
            d="M-48 186 L-48 166 Q-46 154 -32 152 L-18 150 L-4 132 Q2 126 12 126 L40 126 Q50 126 56 134 L66 150 Q86 152 92 160 L94 186Z"
            className="fill-copper"
          />
          {/* Two windows with three passengers. */}
          <path d="M-12 150 L0 135 Q4 131 10 131 L22 131 L22 150Z" className="fill-gold" />
          <path d="M28 131 L40 131 Q47 131 51 137 L58 150 L28 150Z" className="fill-gold" />
          <circle cx={6} cy={142} r={5.5} className="fill-foreground" />
          <circle cx={17} cy={143} r={4.5} className="fill-foreground" />
          <circle cx={42} cy={142} r={5.5} className="fill-foreground" />
          <rect x={86} y={164} width={8} height={6} rx={2} className="fill-amber" />
          <rect x={-48} y={164} width={6} height={6} rx={2} className="fill-destructive" />
          {[-24, 64].map((cx, i) => (
            <g key={cx} transform={`translate(${cx} 186)`}>
              <g ref={wheelRef(i)}>
                <circle r={13} className="fill-foreground" />
                <circle r={6} className="fill-sand-strong" />
                <rect x={-1.5} y={-11} width={3} height={22} className="fill-sand-strong" />
              </g>
            </g>
          ))}
        </g>
      </g>
    </svg>
  );
}
