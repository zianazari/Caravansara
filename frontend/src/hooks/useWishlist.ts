"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { api } from "@/api/client";
import { useAuthState } from "@/hooks/useAuth";
import { usePathname, useRouter } from "@/i18n/navigation";
import { errorMessage, type Translate } from "@/lib/errors";

export const WISHLIST_IDS = ["me", "wishlist", "ids"] as const;

/**
 * The member's saved listings (feature 012), for the hearts on cards and the listing page. One request for every
 * card on a page (GET /me/wishlist/ids, at most 500 ids); a heart changes at once and goes back if the API
 * refuses. A visitor who is not signed in is sent to log in and comes back to the same page.
 */
export function useWishlist() {
  const t = useTranslations();
  const state = useAuthState();
  const client = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const ids = useQuery({
    queryKey: WISHLIST_IDS,
    enabled: state === "signedIn",
    staleTime: 60 * 1000,
    queryFn: async () => (await api.GET("/api/v1/me/wishlist/ids")).data?.listing_ids ?? [],
  });
  const saved = new Set(ids.data ?? []);

  const toggle = useMutation({
    mutationFn: async ({ id, save }: { id: number; save: boolean }) => {
      const path = { params: { path: { listing_id: id } } };
      const { error } = save
        ? await api.PUT("/api/v1/me/wishlist/{listing_id}", path)
        : await api.DELETE("/api/v1/me/wishlist/{listing_id}", path);
      if (error) throw error;
    },
    onMutate: async ({ id, save }) => {
      await client.cancelQueries({ queryKey: WISHLIST_IDS });
      const before = client.getQueryData<number[]>(WISHLIST_IDS) ?? [];
      client.setQueryData<number[]>(WISHLIST_IDS, save ? [id, ...before] : before.filter((x) => x !== id));
      return { before };
    },
    onError: (error, _vars, context) => {
      if (context) client.setQueryData(WISHLIST_IDS, context.before);
      toast.error(errorMessage(t as unknown as Translate, error));
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ["me", "wishlist"] });
    },
  });

  return {
    saved,
    // While the session is still being restored after a page load, a tap would wrongly send a signed-in
    // member to log in; the heart waits until the state is known.
    ready: state === "signedIn" || state === "signedOut",
    toggle(id: number) {
      if (state === "signedOut") {
        router.push({ pathname: "/login", query: { returnTo: pathname } });
        return;
      }
      if (state !== "signedIn") return;
      toggle.mutate({ id, save: !saved.has(id) });
    },
  };
}
