/**
 * Which page numbers a pager shows (feature 025): always the first and the last page, and at most
 * `middle` pages between them around the current one. A "gap" stands for the pages left out, so a long
 * queue keeps a short pager while page 1 and the last page are always one click away.
 */
export type PageSlot = number | "gap";

export function pageWindow(current: number, last: number, middle = 10): PageSlot[] {
  if (last <= 1) return [1];
  const page = Math.min(Math.max(current, 1), last);
  const inner = last - 2; // pages strictly between the first and the last
  let start = 2;
  let end = last - 1;
  if (inner > middle) {
    start = Math.max(2, page - Math.floor((middle - 1) / 2));
    end = start + middle - 1;
    if (end > last - 1) {
      end = last - 1;
      start = end - middle + 1;
    }
  }
  const slots: PageSlot[] = [1];
  if (start > 2) slots.push("gap");
  for (let n = start; n <= end; n += 1) slots.push(n);
  if (end < last - 1) slots.push("gap");
  slots.push(last);
  return slots;
}

/** The last page for `total` items at `size` per page; an empty list still has page 1. */
export function lastPage(total: number, size: number): number {
  return Math.max(1, Math.ceil(total / size));
}

/** A page number from the address bar: a whole number from 1, or 1 for anything else. */
export function parsePage(raw: string | null): number {
  const page = Number(raw);
  return Number.isSafeInteger(page) && page >= 1 ? page : 1;
}
