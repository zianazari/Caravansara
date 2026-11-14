import { ArrowUpLeftIcon, SparklesIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export function OpportunityInvite() {
  const t = useTranslations("opportunities");
  return (
    <Link
      href="/opportunities"
      className="group flex flex-wrap items-center gap-5 rounded-3xl border border-primary/25 bg-surface px-6 py-7 transition-colors hover:border-primary/60 md:px-9"
    >
      <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
        <SparklesIcon className="size-6" aria-hidden />
      </span>
      <span className="grid flex-1 gap-2">
        <span className="text-xl font-bold md:text-2xl">{t("inviteTitle")}</span>
        <span className="text-base leading-7 text-muted-foreground">{t("inviteDescription")}</span>
      </span>
      <span className="inline-flex items-center gap-3 text-base font-bold text-primary">
        {t("name")}
        <ArrowUpLeftIcon className="size-5 ltr:rotate-90" aria-hidden />
      </span>
    </Link>
  );
}
