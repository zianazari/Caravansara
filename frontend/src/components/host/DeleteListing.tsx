"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { errorMessage, type Translate } from "@/lib/errors";

export function DeleteListing({ id, title }: { id: number; title: string }) {
  const t = useTranslations();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string>();
  async function remove() {
    if (busy) return;
    setBusy(true);
    setProblem(undefined);
    try {
      const { response, error } = await api.DELETE("/api/v1/listings/{listing_id}", {
        params: { path: { listing_id: id } },
      });
      if (!response.ok) {
        setProblem(errorMessage(t as unknown as Translate, error));
        return;
      }
      setOpen(false);
      toast.success(t("host.deleted"));
      await client.invalidateQueries({ queryKey: ["me", "listings"] });
    } catch {
      setProblem(t("errors.service_unavailable"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-destructive"
        onClick={() => {
          setProblem(undefined);
          setOpen(true);
        }}
      >
        <Trash2Icon aria-hidden />
        {t("host.deleteListing")}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!busy) setOpen(next);
        }}
      >
        <DialogContent closeLabel={t("common.close")}>
          <DialogTitle>{t("host.deleteTitle", { title })}</DialogTitle>
          <DialogDescription>{t("host.deleteDescription")}</DialogDescription>
          {problem ? (
            <p role="alert" className="text-sm text-destructive">
              {problem}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="button" variant="destructive" disabled={busy} onClick={() => void remove()}>
              {t(busy ? "auth.working" : "host.deleteListing")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
