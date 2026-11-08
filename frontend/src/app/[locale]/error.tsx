"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/** Any unexpected failure: a short message in the user's language and a way to try again (Edge Cases). */
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("common");
  return (
    <section role="alert" className="mx-auto grid max-w-md gap-4 py-16 text-center">
      <h1 className="text-2xl font-bold">{t("errorTitle")}</h1>
      <p className="text-muted-foreground">{t("errorText")}</p>
      <Button onClick={reset} className="justify-self-center">
        {t("retry")}
      </Button>
    </section>
  );
}
