import {
  CircleCheckIcon,
  CircleOffIcon,
  ClockIcon,
  ImageOffIcon,
  OctagonXIcon,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { HostStatus } from "@/lib/listingStatus";
import { cn } from "@/lib/cn";

const LOOK: Record<HostStatus, { Icon: LucideIcon; className: string }> = {
  pending: { Icon: ClockIcon, className: "bg-amber/15 text-foreground ring-amber" },
  active: { Icon: CircleCheckIcon, className: "bg-primary/10 text-primary ring-primary" },
  inactive: { Icon: CircleOffIcon, className: "bg-muted text-muted-foreground ring-border" },
  rejected: { Icon: OctagonXIcon, className: "bg-destructive/10 text-destructive ring-destructive" },
};

/**
 * A listing's status as the host sees it (specs/008-host-pages, R10). Each has its words and its icon, not a
 * colour alone, so it reads the same without colour; the colours are the theme's tokens (rule of 007).
 */
export function StatusBadge({ status }: { status: HostStatus }) {
  const t = useTranslations("host");
  const { Icon, className } = LOOK[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1",
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {t(`status_${status}`)}
    </span>
  );
}

/** "Photos not complete": apart from the status, for a listing with fewer than three photos (FR-016). */
export function FewPhotosBadge() {
  const t = useTranslations("host");
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber/15 px-2.5 py-0.5 text-xs font-semibold ring-1 ring-amber">
      <ImageOffIcon className="size-3.5" aria-hidden />
      {t("fewPhotos")}
    </span>
  );
}
