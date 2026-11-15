"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe } from "@/hooks/useAuth";
import { normalizePhone } from "@/lib/phone";
import { errorMessage, type Translate } from "@/lib/errors";
import { AvatarUploader } from "./AvatarUploader";

/**
 * The profile: name, optional private mobile contact and picture. Logging out is in the header's account menu since
 * feature 024 (owner's request), not here. The name is changed with
 * PATCH /me with name and changed phone number; the site never sends `avatar_url` there, pictures go through
 * PUT /me/avatar (FR-041).
 */
export function AccountView() {
  const t = useTranslations();
  const me = useMe();
  const queryClient = useQueryClient();
  const [name, setName] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  if (!me.data) {
    return (
      <div className="grid gap-3" aria-busy="true">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-24 w-24 rounded-full" />
      </div>
    );
  }
  const user = me.data;
  const shown = name ?? user.full_name;
  const shownPhone = phone ?? user.phone_number ?? "";
  const phoneChanged = shownPhone !== (user.phone_number ?? "");

  async function saveName(event: FormEvent) {
    event.preventDefault();
    const trimmed = shown.trim();
    if (trimmed.length < 1 || trimmed.length > 100) {
      setError(t("validation.nameLength"));
      return;
    }
    setError(undefined);
    setPhoneError(undefined);
    let canonical: string | null;
    try {
      canonical = normalizePhone(shownPhone);
    } catch {
      setPhoneError(t("validation.phoneNumber"));
      return;
    }
    setBusy(true);
    const result = await api.PATCH("/api/v1/me", {
      body: { full_name: trimmed, ...(phoneChanged ? { phone_number: canonical } : {}) },
    });
    setBusy(false);
    if (result.data) {
      queryClient.setQueryData(["me"], result.data);
      setName(null);
      setPhone(null);
      toast.success(t("account.profileSaved"));
    } else {
      setError(errorMessage(t as unknown as Translate, result.error));
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-2xl min-w-0 gap-8 rounded-3xl border bg-card p-5 shadow-sm md:p-8">
      <h1 className="text-2xl font-bold">{t("account.title")}</h1>
      <AvatarUploader user={user} />
      <section aria-labelledby="profile" className="grid gap-3">
        <h2 id="profile" className="text-lg font-semibold">
          {t("account.profile")}
        </h2>
        <p className="text-sm break-all text-muted-foreground">{t("account.email", { email: user.email })}</p>
        <form onSubmit={saveName} className="grid gap-4">
          <div className="min-w-60 flex-1">
            <Field label={t("auth.fullName")} error={error}>
              {(p) => <Input {...p} value={shown} onChange={(e) => setName(e.target.value)} />}
            </Field>
          </div>
          <Field label={t("account.phoneNumber")} error={phoneError} hint={t("account.phoneHint")}>
            {(p) => (
              <Input
                {...p}
                type="tel"
                dir="ltr"
                autoComplete="tel"
                maxLength={64}
                value={shownPhone}
                onChange={(e) => setPhone(e.target.value)}
              />
            )}
          </Field>
          <Button type="submit" disabled={busy || (shown.trim() === user.full_name && !phoneChanged)}>
            {t("common.save")}
          </Button>
        </form>
      </section>
    </div>
  );
}
