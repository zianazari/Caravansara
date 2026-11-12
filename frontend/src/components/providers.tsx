"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Direction } from "radix-ui";
import { Toaster } from "sonner";

export function Providers({ children, dir }: { children: ReactNode; dir: "rtl" | "ltr" }) {
  // One client per browser tab; server data is cached for a short time only.
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
      }),
  );
  return (
    // Radix menus, selects and tabs read the direction from here, so arrow keys and placement follow RTL.
    <Direction.DirectionProvider dir={dir}>
      <QueryClientProvider client={client}>
        {children}
        {/*
          Feature 050 (owner's request: messages such as "listing activated" sat too low to notice): toasts appear
          at the top centre, just under the 4rem header, where the eye already is; on a phone they no longer sit
          over the bottom bar. A larger, bolder text and the theme's colours (richColors) make them readable.
          no-print: a toast must not land on a printed receipt (feature 047).
        */}
        <Toaster
          className="no-print"
          dir={dir}
          position="top-center"
          offset={{ top: 76 }}
          mobileOffset={{ top: 72 }}
          richColors
          toastOptions={{ classNames: { toast: "text-base font-semibold shadow-lg", title: "text-base" } }}
        />
      </QueryClientProvider>
    </Direction.DirectionProvider>
  );
}
