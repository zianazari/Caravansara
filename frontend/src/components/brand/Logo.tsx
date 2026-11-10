import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

/**
 * The site's mark: a small caravansara arch in amber-to-copper next to the name (specs/007-caravansara-theme,
 * FR-003, research R9). The favicon (src/app/icon.svg) is the same arch.
 */
export function Logo({ className }: { className?: string }) {
  const t = useTranslations("common");
  return (
    <span className={cn("flex items-center gap-2 text-xl font-extrabold text-primary", className)}>
      <span aria-hidden className="arch block h-8 w-7 bg-linear-to-b from-amber to-copper" />
      {t("siteName")}
    </span>
  );
}
