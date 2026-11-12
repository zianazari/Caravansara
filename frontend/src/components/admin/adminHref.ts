/**
 * Addresses inside the admin panel (feature 051). The tab, its filter and its page live in the address bar, so a
 * reload and the back button keep them. Defaults (the queue tab, page 1, no filter) stay out of the address.
 */
export type AdminTab = "queue" | "bookings" | "users";

export function parseTab(raw: string | null): AdminTab {
  return raw === "bookings" || raw === "users" ? raw : "queue";
}

export function adminHref(tab: AdminTab, values: Record<string, string | number | undefined> = {}): string {
  const query = new URLSearchParams();
  if (tab !== "queue") query.set("tab", tab);
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === "" || (key === "page" && Number(value) <= 1)) continue;
    query.set(key, String(value));
  }
  const text = query.toString();
  return text ? `/admin?${text}` : "/admin";
}
