import type { ListingDraft } from "@/lib/listingDraft";

/** What every step of the listing form gets (specs/008-host-pages, T023): the answers, a way to change them,
 * and the translated problems of its own fields. */
export type StepProps = {
  draft: ListingDraft;
  onChange: (changes: ListingDraft) => void;
  errors: Record<string, string>;
};
