"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

/**
 * Asked before a change that hides an approved listing until a system admin approves it again: its description,
 * place, type, amenities, a new photo or a photo's label (specs/008-host-pages, FR-010, research R8; the rule of
 * feature 004). Changes that need no review never show it, so the warning keeps its meaning.
 */
export function ReviewWarningDialog({
  open,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations();
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onCancel())}>
      <DialogContent closeLabel={t("common.close")}>
        <DialogTitle>{t("host.warnTitle")}</DialogTitle>
        <DialogDescription>{t("host.warnText")}</DialogDescription>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" className="rounded-full" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button className="rounded-full" onClick={onConfirm}>
            {t("host.warnConfirm")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
