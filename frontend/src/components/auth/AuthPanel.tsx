"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { LogoMark } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";

export function AuthPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mx-auto mt-4 grid w-full max-w-md gap-6 rounded-3xl border bg-card p-6 shadow-xl shadow-foreground/5 md:mt-8 md:p-8">
      <LogoMark className="mx-auto -mb-2 h-11 w-10" />
      <h1 className="text-center text-2xl font-bold">{title}</h1>
      {children}
    </section>
  );
}

type LoginMethod = "password" | "email";

export function AuthMethods({
  value,
  onChange,
}: {
  value: LoginMethod;
  onChange: (method: LoginMethod) => void;
}) {
  const t = useTranslations("emailLogin");
  return (
    <div
      role="group"
      aria-label={t("chooseMethod")}
      className="grid grid-cols-2 gap-2 rounded-2xl bg-surface p-1.5"
    >
      {(["password", "email"] as const).map((method) => (
        <Button
          key={method}
          type="button"
          variant={value === method ? "soft" : "ghost"}
          aria-pressed={value === method}
          onClick={() => onChange(method)}
        >
          {t(method === "password" ? "passwordMethod" : "emailMethod")}
        </Button>
      ))}
    </div>
  );
}
