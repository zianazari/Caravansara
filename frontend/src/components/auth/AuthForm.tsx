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
import { safeReturnTo } from "@/lib/returnTo";
import { setSession } from "@/lib/session";

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
  const [values, setValues] = useState({ email: "", password: "", full_name: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
        : { ...values, email: values.email.trim() };
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
      setSession(session.access_token, session.expires_in);
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      router.replace(safeReturnTo(returnTo));
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
    <section className="mx-auto mt-4 grid w-full max-w-md gap-6 rounded-3xl border bg-card p-6 shadow-xl shadow-foreground/5 md:mt-8 md:p-8">
      {/* 007: a small caravansara arch above the form, as on every page of the theme. */}
      <span aria-hidden className="arch mx-auto -mb-2 block h-10 w-9 bg-linear-to-b from-amber to-copper" />
      <h1 className="text-center text-2xl font-bold">
        {t(mode === "login" ? "auth.loginTitle" : "auth.registerTitle")}
      </h1>
      <form onSubmit={submit} noValidate className="grid gap-4">
        {problem ? (
          <p role="alert" className="rounded-lg border border-destructive p-3 text-sm text-destructive">
            {problem}
          </p>
        ) : null}
        {mode === "register" ? (
          <Field label={t("auth.fullName")} error={errors.full_name}>
            {(p) => <Input {...p} autoComplete="name" value={values.full_name} onChange={set("full_name")} />}
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
      <p className="text-sm">
        {t(mode === "login" ? "auth.noAccount" : "auth.haveAccount")}{" "}
        <Link
          href={{ pathname: `/${other}`, query: returnTo ? { returnTo } : {} }}
          className="font-medium text-primary underline"
        >
          {t(mode === "login" ? "nav.register" : "nav.login")}
        </Link>
      </p>
    </section>
  );
}
