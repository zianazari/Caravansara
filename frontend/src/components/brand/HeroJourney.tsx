"use client";

import { useLocale } from "next-intl";
import { useEffect, useRef, useState, type ReactNode } from "react";
import courtyard from "@/assets/hero-courtyard.jpg";
import { PARK_X, PLACE_AHEAD, START, STOPS, VIEW, WORLD, journeyAt, type StopKind } from "@/lib/heroJourney";

/** How quickly the drawn car catches up with the scroll each frame: it rolls on a little after a scroll. */
const CATCH_UP = 0.1;
/** The far hills move slower than the road, for depth. */
const FAR_SPEED = 0.35;
/** Progress at which the car is shown under reduced motion: parked at the caravansara. */
const STILL = (STOPS.indexOf("caravansara") + 0.75) / STOPS.length;

/**
 * The home page hero's story (features 041, 041b; owner's requests): a car with three passengers drives along
 * a road and stops at a garden, a villa, a caravansara (its gate frames the owner's courtyard photo, 027), an
 * apartment block, a forest cabin and an eco-lodge. The hero is a strip pinned under the header for the whole
 * page (041c), and the trip follows the scroll of the whole page; scrolling up drives the car back. The strip
 * has no text (041c): the places are known by their shapes, and the one being visited lights up. The road is
 * longer than the view, so the view follows the car like a camera, and the far hills move slower for depth.
 * While nobody scrolls, the car idles with a slight bob (CSS). It is daytime since 041d: a sun and drifting
 * clouds over light sand hills, on the page's own background. On the Persian site the road runs right to left.
 *
 * Plain SVG in the theme's colours, sharp at any size. Scroll is read once per frame with
 * requestAnimationFrame and the car, the world and the hills are moved by setting SVG attributes directly, so
 * React does not re-render each frame. Decoration only: hidden from screen readers. Under
 * prefers-reduced-motion nothing moves, and the car is parked at the caravansara.
 */
export function HeroJourney() {
  const rtl = useLocale() === "fa";
  const svg = useRef<SVGSVGElement>(null);
  const world = useRef<SVGGElement>(null);
  const far = useRef<SVGGElement>(null);
  const car = useRef<SVGGElement>(null);
  const wheels = useRef<SVGGElement[]>([]);
  const places = useRef<SVGGElement[]>([]);
  // On a narrow screen the whole 1000-wide view would be drawn tiny; there the scene fills its box and keeps
  // the middle, which holds the car and the place ahead of it (041b).
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const query = window.matchMedia?.("(max-width: 767px)");
    if (!query) return;
    const update = () => setNarrow(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const scene = svg.current;
    const road = world.current;
    const hills = far.current;
    const body = car.current;
    if (!scene || !road || !hills || !body) return;
    // Without matchMedia (an old browser, or the test DOM) the visitor has not asked for less motion.
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let shown = reduced ? STILL : 0;
    let target = shown;
    let frame = 0;

    const place = (progress: number) => {
      const { x, parkedAt, camera } = journeyAt(progress);
      road.setAttribute("transform", `translate(${-camera} 0)`);
      hills.setAttribute("transform", `translate(${-camera * FAR_SPEED} 0)`);
      body.setAttribute("transform", `translate(${x} 0)`);
      for (const wheel of wheels.current) wheel.setAttribute("transform", `rotate(${(x * 3.2) % 360})`);
      places.current.forEach((g, i) => (g.dataset.active = String(i === parkedAt)));
      scene.dataset.moving = Math.abs(target - shown) > 0.002 ? "true" : "false";
    };
    const step = () => {
      shown += (target - shown) * CATCH_UP;
      if (Math.abs(target - shown) < 0.0005) shown = target;
      place(shown);
      frame = shown === target ? 0 : requestAnimationFrame(step);
    };
    /** Progress is how far the whole page has scrolled (041c): the strip is always in view, so is the trip. */
    const onScroll = () => {
      const room = document.documentElement.scrollHeight - window.innerHeight;
      target = window.scrollY / Math.max(1, room);
      if (!frame) frame = requestAnimationFrame(step);
    };

    place(shown);
    if (reduced) return;
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  /** Text and the photo are drawn back the right way round inside the mirrored Persian scene. */
  const unmirror = rtl ? "scale(-1 1)" : undefined;

  return (
    <svg
      ref={svg}
      aria-hidden
      data-hero="scene"
      viewBox={`0 0 ${VIEW} 220`}
      preserveAspectRatio={narrow ? "xMidYMax slice" : "xMidYMax meet"}
      overflow="visible"
      className="hero-scene absolute inset-0 h-full w-full"
    >
      <defs>
        <clipPath id="hero-gate-arch">
          <path d="M-34 0V-58C-34 -80 -16 -94 0 -106C16 -94 34 -80 34 -58V0Z" />
        </clipPath>
      </defs>

      {/* Daytime (041d): a sun and a few clouds that drift slowly, in the view itself, not the moving world. */}
      <circle cx={860} cy={58} r={24} className="fill-amber opacity-80" />
      <g className="fill-card">
        {[
          { x: 180, y: 46, s: 1 },
          { x: 470, y: 30, s: 0.8 },
          { x: 690, y: 70, s: 0.65 },
        ].map((c) => (
          <g key={c.x} transform={`translate(${c.x} ${c.y}) scale(${c.s})`}>
            <g className="hero-cloud">
              <ellipse cx={0} cy={0} rx={34} ry={12} />
              <ellipse cx={-16} cy={-7} rx={16} ry={11} />
              <ellipse cx={12} cy={-10} rx={20} ry={14} />
            </g>
          </g>
        ))}
      </g>

      <g transform={rtl ? `translate(${VIEW} 0) scale(-1 1)` : undefined}>
        <g ref={far}>
          <path
            d={`M-600 190 ${Array.from({ length: 14 }, (_, i) => `L${i * 420 - 300} ${i % 2 ? 128 : 160}`).join(" ")} L${WORLD + 1200} 150 L${WORLD + 1200} 190Z`}
            className="fill-sand-strong opacity-50"
          />
        </g>

        <g ref={world}>
          <rect x={-600} y={186} width={WORLD + 1800} height={34} className="fill-foreground" />
          <line
            x1={-600}
            x2={WORLD + 1200}
            y1={203}
            y2={203}
            className="stroke-gold"
            strokeWidth={2}
            strokeDasharray="18 16"
          />

          {STOPS.map((kind, i) => (
            <g
              key={kind}
              ref={(el) => {
                if (el) places.current[i] = el;
              }}
              data-stop={kind}
              className="hero-stop"
              transform={`translate(${PARK_X[i]! + PLACE_AHEAD} 186)`}
            >
              {PLACES[kind](unmirror)}
            </g>
          ))}

          {/* The car, drawn facing forward (+x); the whole scene is mirrored on the Persian site. */}
          <g ref={car} transform={`translate(${START} 0)`}>
            <g className="hero-car-idle">
              <path
                d="M-48 186 L-48 166 Q-46 154 -32 152 L-18 150 L-4 132 Q2 126 12 126 L40 126 Q50 126 56 134 L66 150 Q86 152 92 160 L94 186Z"
                className="fill-copper"
              />
              <path d="M-12 150 L0 135 Q4 131 10 131 L22 131 L22 150Z" className="fill-gold" />
              <path d="M28 131 L40 131 Q47 131 51 137 L58 150 L28 150Z" className="fill-gold" />
              <circle cx={6} cy={142} r={5.5} className="fill-foreground" />
              <circle cx={17} cy={143} r={4.5} className="fill-foreground" />
              <circle cx={42} cy={142} r={5.5} className="fill-foreground" />
              <rect x={86} y={164} width={8} height={6} rx={2} className="fill-amber" />
              <rect x={-48} y={164} width={6} height={6} rx={2} className="fill-destructive" />
              {[-24, 64].map((cx, i) => (
                <g key={cx} transform={`translate(${cx} 186)`}>
                  <g
                    ref={(el) => {
                      if (el) wheels.current[i] = el;
                    }}
                  >
                    <circle r={13} className="fill-foreground" />
                    <circle r={6} className="fill-sand-strong" />
                    <rect x={-1.5} y={-11} width={3} height={22} className="fill-sand-strong" />
                  </g>
                </g>
              ))}
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
}

/**
 * The six places, each standing on the road's edge (y = 0 is the ground). Windows and pools with
 * .hero-lit light up while the car is parked there. Simple shapes in the theme's colours.
 */
const PLACES: Record<StopKind, (unmirror?: string) => ReactNode> = {
  garden: () => (
    <>
      {[-80, -20, 45].map((x, i) => (
        <g key={x}>
          <rect x={x - 3} y={-34} width={6} height={34} className="fill-muted-foreground" />
          <circle cx={x} cy={-48 - (i % 2) * 8} r={20 + (i % 2) * 4} className="fill-leaf" />
        </g>
      ))}
      <rect x={-110} y={-8} width={220} height={8} className="fill-sand-strong" />
      <rect x={-40} y={-6} width={70} height={6} rx={2} className="fill-water" />
      <path
        d="M86 0V-30C86 -42 94 -50 100 -54C106 -50 114 -42 114 -30V0"
        className="fill-none stroke-sand-strong"
        strokeWidth={5}
      />
    </>
  ),
  villa: () => (
    <>
      <rect x={-75} y={-62} width={130} height={62} className="fill-sand-strong" />
      <path d="M-86 -60 L-10 -92 L66 -60Z" className="fill-destructive" />
      <rect x={-18} y={-34} width={18} height={34} className="fill-copper" />
      {[-58, 20].map((x) => (
        <rect key={x} x={x} y={-48} width={22} height={18} rx={2} className="hero-lit fill-night" />
      ))}
      <rect x={66} y={-7} width={60} height={7} rx={2} className="fill-water" />
      <circle cx={-100} cy={-36} r={18} className="fill-leaf" />
      <rect x={-102} y={-20} width={4} height={20} className="fill-muted-foreground" />
    </>
  ),
  caravansara: (unmirror) => (
    <>
      <rect x={-110} y={-62} width={220} height={62} className="fill-sand-strong" />
      <rect x={-122} y={-84} width={24} height={84} className="fill-copper" />
      <rect x={98} y={-84} width={24} height={84} className="fill-copper" />
      <rect x={-46} y={-118} width={92} height={118} className="fill-copper" />
      <g clipPath="url(#hero-gate-arch)">
        <g transform={unmirror}>
          <image
            href={courtyard.src}
            x={-60}
            y={-110}
            width={120}
            height={110}
            preserveAspectRatio="xMidYMid slice"
          />
        </g>
      </g>
      <path
        d="M-34 0V-58C-34 -80 -16 -94 0 -106C16 -94 34 -80 34 -58V0"
        className="hero-glow fill-none stroke-amber"
        strokeWidth={4}
      />
    </>
  ),
  apartment: () => (
    <>
      {[
        { x: -70, w: 56, h: 104 },
        { x: -8, w: 64, h: 132 },
        { x: 62, w: 44, h: 80 },
      ].map((b) => (
        <g key={b.x}>
          <rect x={b.x} y={-b.h} width={b.w} height={b.h} className="fill-muted-foreground" />
          {Array.from({ length: Math.floor((b.h - 12) / 20) }, (_, row) =>
            [0, 1].map((col) => (
              <rect
                key={`${row}-${col}`}
                x={b.x + 8 + col * ((b.w - 16) / 2 + 2)}
                y={-b.h + 10 + row * 20}
                width={(b.w - 20) / 2}
                height={9}
                rx={1.5}
                className="hero-lit fill-night"
              />
            )),
          )}
        </g>
      ))}
    </>
  ),
  cabin: () => (
    <>
      {[-90, -62, 74, 100].map((x, i) => (
        <path
          key={x}
          d={`M${x} 0 L${x - 18} 0 L${x - 9} ${-56 - (i % 2) * 14}Z`}
          transform={`translate(9 0)`}
          className="fill-leaf"
        />
      ))}
      <path d="M-46 0 L0 -86 L46 0Z" className="fill-copper" />
      <path d="M-30 0 L0 -56 L30 0Z" className="fill-sand-strong" />
      <rect x={-9} y={-24} width={18} height={24} className="fill-foreground" />
      <rect x={-8} y={-46} width={16} height={12} rx={2} className="hero-lit fill-night" />
    </>
  ),
  ecolodge: () => (
    <>
      <rect x={-80} y={-50} width={150} height={50} rx={6} className="fill-sand-strong" />
      <path d="M-50 -50 A34 34 0 0 1 18 -50Z" className="fill-copper" />
      <rect x={42} y={-104} width={24} height={56} className="fill-sand-strong" />
      {[0, 1, 2].map((i) => (
        <rect key={i} x={46 + i * 7} y={-98} width={3} height={18} className="fill-foreground" />
      ))}
      <path d="M-24 0V-22C-24 -30 -18 -35 -12 -37C-6 -35 0 -30 0 -22V0" className="fill-foreground" />
      {[-66, 14].map((x) => (
        <rect key={x} x={x} y={-36} width={18} height={14} rx={3} className="hero-lit fill-night" />
      ))}
    </>
  ),
};
