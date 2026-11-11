"use client";

import { useTranslations } from "next-intl";
import { LogoMark } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";

/** Any unexpected failure: a short message in the user's language and a way to try again (Edge Cases). */
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("common");
  return (
    <section role="alert" className="mx-auto grid max-w-md justify-items-center gap-4 py-16 text-center">
      {/* The site's mark, large and quiet (feature 036: the new logo in place of the old filled arch). */}
      <LogoMark tone="muted" className="h-28 w-24" />
      <h1 className="text-2xl font-bold">{t("errorTitle")}</h1>
      <p className="text-muted-foreground">{t("errorText")}</p>
      <Button onClick={reset} className="rounded-full">
        {t("retry")}
      </Button>
    </section>
  );
}
