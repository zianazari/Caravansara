"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
export function usePriceQuote(listingId: number, start?: string, end?: string) {
  return useQuery({
    queryKey: ["price-quote", listingId, start, end],
    enabled: Boolean(start && end && end > start),
    staleTime: 0,
    retry: false,
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/listings/{listing_id}/pricing/quote", {
        params: { path: { listing_id: listingId }, query: { check_in: start!, check_out: end! } },
      });
      if (!data || typeof data.total_price !== "string" || !Array.isArray(data.nights))
        throw error ?? new Error("Invalid price quote");
      return data;
    },
  });
}
