"use client";

import { useQuery } from "@tanstack/react-query";
import type { components } from "@/api/schema";
import { adminApi } from "@/api/adminClient";
import { AdminRequestError } from "./useAdminGate";

export type AdminSummary = components["schemas"]["AdminSummary"];

/**
 * The panel's numbers (feature 051): the queue size, the accounts and the bookings in each status. Counting every
 * booking takes a moment on a large database, so this is asked once when the panel opens and kept for a minute,
 * not on every page or tab change.
 */
export function useAdminSummary() {
  return useQuery({
    queryKey: ["admin", "summary"],
    retry: false,
    staleTime: 60_000,
    queryFn: async (): Promise<AdminSummary> => {
      const { data, error, response } = await adminApi.GET("/api/v1/admin/summary");
      if (!data) throw new AdminRequestError(response.status, error);
      return data;
    },
  });
}
