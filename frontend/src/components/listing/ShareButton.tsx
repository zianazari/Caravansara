"use client";

import { ShareIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * Share a listing (feature 032): the phone's own share sheet where there is one (Web Share), otherwise the
 * link is copied. Sharing is the visitor's own act, so nothing is sent anywhere by the site itself.
 */
export function ShareButton({ title }: { title: string }) {
  const t = useTranslations("listing");
  async function share() {
    const url = window.location.href.split("?")[0]!;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // The visitor closed the share sheet: nothing to do.
      }
      return;
    }
    await navigator.clipboard?.writeText(url);
    toast.success(t("linkCopied"));
  }
  return (
    <Button
      variant="ghost"
      size="sm"
      className="rounded-full underline-offset-4"
      onClick={() => void share()}
    >
      <ShareIcon aria-hidden className="rtl:-scale-x-100" />
      {t("share")}
    </Button>
  );
}
