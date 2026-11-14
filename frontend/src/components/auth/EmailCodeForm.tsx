"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { components } from "@/api/schema";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { errorMessage, readError, type Translate } from "@/lib/errors";
import { CodeInput } from "./CodeInput";

type PublicSession = { access_token: string; expires_in: number };

export function EmailCodeForm({ onSuccess }: { onSuccess: (session: PublicSession) => Promise<void> }) {
  const t = useTranslations();
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<components["schemas"]["EmailCodeChallenge"]>();
  const [deadline, setDeadline] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string>();
  const [problem, setProblem] = useState<string>();
  const [busy, setBusy] = useState(false);
  const codeInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (challenge) codeInput.current?.focus();
  }, [challenge]);

  useEffect(() => {
    if (!deadline) return;
    const timer = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSeconds(left);
      if (!left) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [deadline]);

  async function send() {
    setError(undefined);
    setProblem(undefined);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError(t("validation.email"));
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/session/email-code/request", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), locale }),
      });
      if (!response.ok) {
        setProblem(errorMessage(t as unknown as Translate, await readError(response)));
        return;
      }
      const next = (await response.json()) as components["schemas"]["EmailCodeChallenge"];
      setChallenge(next);
      setCode("");
      setSeconds(next.resend_after);
      setDeadline(Date.now() + next.resend_after * 1000);
    } catch {
      setProblem(t("errors.service_unavailable"));
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!challenge) {
      await send();
      return;
    }
    setProblem(undefined);
    setError(undefined);
    if (!/^[0-9]{5}$/.test(code)) {
      setError(t("emailLogin.invalidCode"));
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/session/email-code/verify", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ challenge_id: challenge.challenge_id, code }),
      });
      if (!response.ok) {
        setProblem(errorMessage(t as unknown as Translate, await readError(response)));
        return;
      }
      await onSuccess((await response.json()) as PublicSession);
    } catch {
      setProblem(t("errors.service_unavailable"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      {!challenge ? <p className="text-sm leading-7 text-muted-foreground">{t("emailLogin.hint")}</p> : null}
      {problem ? (
        <p role="alert" className="rounded-xl border border-destructive p-3 text-sm text-destructive">
          {problem}
        </p>
      ) : null}
      <Field label={t("auth.email")} error={!challenge ? error : undefined}>
        {(p) => (
          <Input
            {...p}
            type="email"
            autoComplete="email"
            dir="ltr"
            value={email}
            readOnly={Boolean(challenge)}
            disabled={busy && !challenge}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}
      </Field>
      {challenge ? (
        <>
          <div role="status" className="rounded-xl bg-primary/10 p-3 text-sm leading-7">
            {t("emailLogin.sent")}
          </div>
          <Field label={t("emailLogin.code")} error={error} hint={t("emailLogin.codeHint")}>
            {(p) => <CodeInput {...p} ref={codeInput} value={code} onChange={setCode} />}
          </Field>
        </>
      ) : null}
      <Button size="lg" type="submit" disabled={busy}>
        {busy ? t("auth.working") : t(challenge ? "emailLogin.verify" : "emailLogin.send")}
      </Button>
      {challenge ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" type="button" disabled={busy || seconds > 0} onClick={() => void send()}>
            {seconds > 0
              ? t("emailLogin.resendWait", { seconds: new Intl.NumberFormat(locale).format(seconds) })
              : t("emailLogin.resend")}
          </Button>
          <Button
            variant="ghost"
            type="button"
            disabled={busy}
            onClick={() => {
              setChallenge(undefined);
              setCode("");
              setError(undefined);
              setProblem(undefined);
            }}
          >
            {t("emailLogin.changeEmail")}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
