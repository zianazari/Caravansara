"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { adminLogin } from "@/api/adminClient";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";
import { errorMessage, readError, type Translate } from "@/lib/errors";

/** The admin log-in (feature 009). Admin accounts exist only through `caravansara create-admin` on the server. */
export function AdminLogin() {
  const t = useTranslations();
  const router = useRouter();
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
    <AuthPanel title={t("admin.loginTitle")}>
      <form
        noValidate
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
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
          <p role="alert" className="rounded-lg border border-destructive p-3 text-sm text-destructive">
            {problem}
          </p>
        ) : null}
        <Button type="submit" size="lg" disabled={busy || !email || !password}>
          {busy ? t("admin.loggingIn") : t("admin.login")}
        </Button>
      </form>
    </AuthPanel>
  );
}
