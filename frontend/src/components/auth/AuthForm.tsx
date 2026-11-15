"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Link, useRouter } from "@/i18n/navigation";
import { errorMessage, fieldErrors, readError, type Translate } from "@/lib/errors";
import { normalizePhone } from "@/lib/phone";
import { safeReturnTo } from "@/lib/returnTo";
import { setSession } from "@/lib/session";
import { EmailCodeForm } from "./EmailCodeForm";
import { AuthMethods, AuthPanel } from "./AuthPanel";

type Mode = "login" | "register";

/**
 * Log in or sign up through the site's /session handlers (research R3): the refresh token goes into an
 * HttpOnly cookie there, and the page keeps only the access token in memory. Afterwards the visitor returns
 * to where they were, with the same choices (FR-014, US2/AC7). The same rules as the API are checked first,
 * so most mistakes get a message next to the field before anything is sent (FR-010).
 */
export function AuthForm({ mode }: { mode: Mode }) {
  const t = useTranslations();
  const router = useRouter();
  const queryClient = useQueryClient();
  const returnTo = useSearchParams().get("returnTo");
  const [values, setValues] = useState({ email: "", password: "", full_name: "", phone_number: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [method, setMethod] = useState<"password" | "email">("password");

  async function complete(session: { access_token: string; expires_in: number }) {
    setSession(session.access_token, session.expires_in);
    await queryClient.invalidateQueries({ queryKey: ["me"] });
    router.replace(safeReturnTo(returnTo));
  }

  function check(): Record<string, string> {
    const found: Record<string, string> = {};
    if (!/^\S+@\S+\.\S+$/.test(values.email.trim())) found.email = t("validation.email");
    if (mode === "register" && (values.password.length < 8 || values.password.length > 128)) {
      found.password = t("validation.passwordLength");
    }
    if (mode === "login" && !values.password) found.password = t("validation.required");
    if (mode === "register" && (values.full_name.trim().length < 1 || values.full_name.trim().length > 100)) {
      found.full_name = t("validation.nameLength");
    }
    if (mode === "register") {
      try {
        normalizePhone(values.phone_number);
      } catch {
        found.phone_number = t("validation.phoneNumber");
      }
    }
    return found;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setProblem(null);
    const found = check();
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    const body =
      mode === "login"
        ? { email: values.email.trim(), password: values.password }
        : {
            email: values.email.trim(),
            password: values.password,
            full_name: values.full_name,
            ...(normalizePhone(values.phone_number)
              ? { phone_number: normalizePhone(values.phone_number) }
              : {}),
          };
    try {
      const response = await fetch(`/session/${mode}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const error = await readError(response);
        const fields = fieldErrors(error);
        setErrors(
          Object.fromEntries(
            Object.entries(fields).map(([field, type]) => [
              field,
              t.has(`validation.${type}`) ? t(`validation.${type}`) : t("validation.invalid"),
            ]),
          ),
        );
        if (!Object.keys(fields).length) setProblem(errorMessage(t as unknown as Translate, error));
        return;
      }
      const session = (await response.json()) as { access_token: string; expires_in: number };
      await complete(session);
    } catch {
      setProblem(t("errors.service_unavailable"));
    } finally {
      setBusy(false);
    }
  }

  const set = (key: keyof typeof values) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [key]: event.target.value }));
  const other = mode === "login" ? "register" : "login";

  return (
    <AuthPanel title={t(mode === "login" ? "auth.loginTitle" : "auth.registerTitle")}>
      {mode === "login" ? <AuthMethods value={method} onChange={setMethod} /> : null}
      {mode === "login" && method === "email" ? (
        <EmailCodeForm onSuccess={complete} />
      ) : (
        <form onSubmit={submit} noValidate className="grid gap-4">
          {problem ? (
            <p role="alert" className="rounded-lg border border-destructive p-3 text-sm text-destructive">
              {problem}
            </p>
          ) : null}
          {mode === "register" ? (
            <Field label={t("auth.fullName")} error={errors.full_name}>
              {(p) => (
                <Input {...p} autoComplete="name" value={values.full_name} onChange={set("full_name")} />
              )}
            </Field>
          ) : null}
          {mode === "register" ? (
            <Field label={t("account.phoneNumber")} error={errors.phone_number} hint={t("account.phoneHint")}>
              {(p) => (
                <Input
                  {...p}
                  type="tel"
                  dir="ltr"
                  autoComplete="tel"
                  maxLength={64}
                  value={values.phone_number}
                  onChange={set("phone_number")}
                />
              )}
            </Field>
          ) : null}
          <Field label={t("auth.email")} error={errors.email}>
            {(p) => (
              <Input
                {...p}
                type="email"
                autoComplete="email"
                dir="ltr"
                value={values.email}
                onChange={set("email")}
              />
            )}
          </Field>
          <Field
            label={t("auth.password")}
            error={errors.password}
            hint={mode === "register" ? t("auth.passwordHint") : undefined}
          >
            {(p) => (
              <Input
                {...p}
                type="password"
                dir="ltr"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={values.password}
                onChange={set("password")}
              />
            )}
          </Field>
          <Button type="submit" size="lg" disabled={busy}>
            {busy ? t("auth.working") : t(mode === "login" ? "auth.login" : "auth.register")}
          </Button>
        </form>
      )}
      <p className="flex flex-wrap items-center gap-2 text-sm">
        {t(mode === "login" ? "auth.noAccount" : "auth.haveAccount")}
        <Button asChild variant="soft" size="sm">
          <Link href={{ pathname: `/${other}`, query: returnTo ? { returnTo } : {} }}>
            {t(mode === "login" ? "nav.register" : "nav.login")}
          </Link>
        </Button>
      </p>
    </AuthPanel>
  );
}
