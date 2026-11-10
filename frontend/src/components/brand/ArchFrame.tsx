import Image from "next/image";
import { cn } from "@/lib/cn";

/**
 * A photo inside the caravansara arch (specs/007-caravansara-theme, FR-003). "soft" is the lower arch for
 * listing cards and the listing's main photo; "tall" is the doorway shape. Without a photo it shows a warm
 * placeholder (an arch of sand on cream, drawn here, no request) instead of a grey box (US2/AC2, research
 * R10). Nothing that matters sits in the top corners, which the arch hides.
 */
export function ArchFrame({
  src,
  alt,
  variant = "soft",
  sizes,
  priority,
  className,
  children,
}: {
  src?: string | null;
  alt: string;
  variant?: "soft" | "tall";
  sizes?: string;
  priority?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-muted",
        variant === "soft" ? "arch-soft" : "arch",
        className,
      )}
      data-arch={variant}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          unoptimized
          draggable={false}
          className="object-cover"
        />
      ) : (
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMax slice"
          className="size-full"
          role={alt ? "img" : undefined}
          aria-label={alt || undefined}
          aria-hidden={alt ? undefined : true}
        >
          <rect width="100" height="100" fill="var(--muted)" />
          <path
            d="M30,100 V62 C30,52 42,46 50,40 C58,46 70,52 70,62 V100 Z"
            fill="var(--sand-strong)"
            opacity="0.7"
          />
          <rect y="88" width="100" height="12" fill="var(--border)" />
        </svg>
      )}
      {children}
    </div>
  );
}
