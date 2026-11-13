export type SortOrder = "asc" | "desc";
export const BOOKING_SORTS = [
  "id",
  "listing",
  "guest",
  "dates",
  "total_price",
  "status",
  "created_at",
] as const;
export const USER_SORTS = ["full_name", "email", "kind", "created_at"] as const;
export const QUEUE_SORTS = ["submitted_at", "title", "city", "host"] as const;

/** Only valid columns reach the API; sorting stays in the URL across pagination and filtering. */
export function readAdminSort<T extends string>(
  params: Pick<URLSearchParams, "get">,
  columns: readonly T[],
  fallback: T,
): { sortBy: T; order: SortOrder; hasSort: boolean } {
  const raw = params.get("sort_by");
  const hasSort = raw !== null && columns.includes(raw as T);
  return {
    sortBy: hasSort ? (raw as T) : fallback,
    order: hasSort && params.get("order") === "asc" ? "asc" : "desc",
    hasSort,
  };
}

export function sortValues<T extends string>(sortBy: T, order: SortOrder, explicit = true) {
  return explicit ? { sort_by: sortBy, order } : {};
}
