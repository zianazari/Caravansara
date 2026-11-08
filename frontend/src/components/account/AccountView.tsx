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
import { useRouter } from "@/i18n/navigation";
import { errorMessage, type Translate } from "@/lib/errors";
import { logout } from "@/lib/session";
import { AvatarUploader } from "./AvatarUploader";

/**
 * The profile (FR-015, US2/AC6, AC8): the name, the picture, and logging out. The name is changed with
 * PATCH /me and only `full_name`; the site never sends `avatar_url` there, pictures go through
 * PUT /me/avatar (FR-041).
 */
export function AccountView() {
  const t = useTranslations();
  const me = useMe();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState<string | null>(null);
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

  async function saveName(event: FormEvent) {
    event.preventDefault();
    const trimmed = shown.trim();
    if (trimmed.length < 1 || trimmed.length > 100) {
      setError(t("validation.nameLength"));
      return;
    }
    setError(undefined);
    setBusy(true);
    const result = await api.PATCH("/api/v1/me", { body: { full_name: trimmed } });
    setBusy(false);
    if (result.data) {
      queryClient.setQueryData(["me"], result.data);
      setName(null);
      toast.success(t("account.nameSaved"));
    } else {
      setError(errorMessage(t as unknown as Translate, result.error));
    }
  }

  async function signOut() {
    await logout();
    queryClient.removeQueries({ queryKey: ["me"] });
    router.replace("/");
  }

  return (
    <div className="grid max-w-xl gap-8">
      <h1 className="text-2xl font-bold">{t("account.title")}</h1>
      <AvatarUploader user={user} />
      <section aria-labelledby="profile" className="grid gap-3">
        <h2 id="profile" className="text-lg font-semibold">
          {t("account.profile")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("account.email", { email: user.email })}</p>
        <form onSubmit={saveName} className="flex flex-wrap items-end gap-2">
          <div className="min-w-60 flex-1">
            <Field label={t("auth.fullName")} error={error}>
              {(p) => <Input {...p} value={shown} onChange={(e) => setName(e.target.value)} />}
            </Field>
          </div>
          <Button type="submit" disabled={busy || shown.trim() === user.full_name}>
            {t("common.save")}
          </Button>
        </form>
      </section>
      <Button variant="outline" className="justify-self-start" onClick={signOut}>
        {t("account.logout")}
      </Button>
    </div>
  );
}
