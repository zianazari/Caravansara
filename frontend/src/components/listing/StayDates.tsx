"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { createContext, useContext, useState, type ReactNode } from "react";
import { api } from "@/api/client";
import { todayInZone } from "@/lib/cityTime";
import { parseSearch } from "@/lib/searchParams";

export type StayRange = { checkIn?: string; checkOut?: string };

type StayDates = {
  dates: StayRange;
  setDates: (dates: StayRange) => void;
  /** Taken nights from GET /listings/{id}/availability; empty until they arrive. */
  booked: ReadonlySet<string>;
  today: string;
};

const Context = createContext<StayDates | null>(null);

/**
 * One choice of dates for the whole listing page (feature 019): the calendar in the page and the booking box
 * read and change the same dates, which start from the search address. The taken nights are read once, for a
 * year from today in the listing's city.
 */
export function StayDatesProvider({
  listingId,
  timezone,
  children,
}: {
  listingId: number;
  timezone: string;
  children: ReactNode;
}) {
  const initial = parseSearch(useSearchParams());
  const [dates, setDates] = useState<StayRange>({ checkIn: initial.check_in, checkOut: initial.check_out });
  const today = todayInZone(timezone);
  const availability = useQuery({
    queryKey: ["availability", listingId],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data } = await api.GET("/api/v1/listings/{listing_id}/availability", {
        params: { path: { listing_id: listingId } },
      });
      return new Set(data?.booked_nights ?? []);
    },
  });
  return (
    <Context.Provider value={{ dates, setDates, booked: availability.data ?? new Set(), today }}>
      {children}
    </Context.Provider>
  );
}

export function useStayDates(): StayDates {
  const value = useContext(Context);
  if (!value) throw new Error("useStayDates needs StayDatesProvider");
  return value;
}
