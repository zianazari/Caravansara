"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { adminLogin } from "@/api/adminClient";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";
import { errorMessage, readError, type Translate } from "@/lib/errors";

/** The admin log-in (feature 009). Admin accounts exist only through `caravansara create-admin` on the server. */
export function AdminLogin() {
  const t = useTranslations();
  const router = useRouter();
  const ended = useSearchParams().get("ended") === "1";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [problem, setProblem] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setProblem(undefined);
    try {
      const res = await adminLogin(email.trim(), password);
      if (res.ok) {
        router.replace("/admin");
        return;
      }
      setProblem(errorMessage(t as unknown as Translate, await readError(res)));
    } catch {
      setProblem(t("errors.service_unavailable"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      noValidate
      className="mx-auto grid w-full max-w-sm gap-4 rounded-2xl border bg-card p-6 shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <h1 className="text-xl font-bold">{t("admin.loginTitle")}</h1>
      {ended ? <p className="text-sm text-muted-foreground">{t("admin.sessionEnded")}</p> : null}
      <Field label={t("admin.email")}>
        {(props) => (
          <Input
            {...props}
            type="email"
            autoComplete="username"
            dir="ltr"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}
      </Field>
      <Field label={t("admin.password")}>
        {(props) => (
          <Input
            {...props}
            type="password"
            autoComplete="current-password"
            dir="ltr"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        )}
      </Field>
      {problem ? (
        <p role="alert" className="text-sm text-destructive">
          {problem}
        </p>
      ) : null}
      <Button type="submit" className="rounded-full" disabled={busy || !email || !password}>
        {busy ? t("admin.loggingIn") : t("admin.login")}
      </Button>
    </form>
  );
}
