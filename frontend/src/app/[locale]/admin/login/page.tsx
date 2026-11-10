import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { AdminLogin } from "@/components/admin/AdminLogin";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: "admin" });
  return { title: t("loginTitle") };
}

export default async function AdminLoginPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return (
    <Suspense>
      <AdminLogin />
    </Suspense>
  );
}
