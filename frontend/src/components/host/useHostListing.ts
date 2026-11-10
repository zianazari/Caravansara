"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";

/** The key of one listing as its host reads it; saving anything invalidates it (analyze L2). */
export const hostListingKey = (id: number) => ["host-listing", id] as const;

/**
 * One listing with the host's token (GET /listings/{id}): it has the photos, the private place and the review
 * state. Shared by the listing cards (which need the number of photos, missing from the list's summary) and
 * the listing's own page, so each is read once. null when the API does not find it.
 */
export function useHostListing(id: number) {
  return useQuery({
    queryKey: hostListingKey(id),
    staleTime: 30 * 1000,
    queryFn: async () => {
      const { data, response } = await api.GET("/api/v1/listings/{listing_id}", {
        params: { path: { listing_id: id } },
      });
      if (data) return data;
      if (response.status === 404) return null;
      throw new Error(`listing ${id}: ${response.status}`);
    },
  });
}
