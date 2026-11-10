"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";

/**
 * Sends the admin to log in when the panel's API says the session is over (401): the token lasts 15 minutes
 * and has no refresh (specs/backend (004)).
 */
export function useAdminGate(status: number | undefined) {
  const router = useRouter();
  useEffect(() => {
    if (status === 401) router.replace("/admin/login?ended=1");
  }, [status, router]);
}

/** A failed panel request, with its status, so the page can tell "log in again" from other errors. */
export class AdminRequestError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(`admin request failed: ${status}`);
  }
}
