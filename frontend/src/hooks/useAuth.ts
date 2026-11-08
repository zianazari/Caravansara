"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useSyncExternalStore } from "react";
import { api } from "@/api/client";
import { ensureToken, isSignedIn, subscribe } from "@/lib/session";

export type AuthState = "checking" | "signedIn" | "signedOut";

let restoreStarted = false;
let restoreDone = false;
const restoreListeners = new Set<() => void>();

function startRestore() {
  if (restoreStarted) return;
  restoreStarted = true;
  void ensureToken().finally(() => {
    restoreDone = true;
    for (const listener of restoreListeners) listener();
  });
}

function subscribeAll(listener: () => void) {
  restoreListeners.add(listener);
  const stop = subscribe(() => listener());
  return () => {
    restoreListeners.delete(listener);
    stop();
  };
}

function snapshot(): AuthState {
  if (isSignedIn()) return "signedIn";
  return restoreDone ? "signedOut" : "checking";
}

/**
 * Whether the visitor is signed in. On the first render after a page load the answer is "checking" while the
 * session is rebuilt once from the HttpOnly cookie (research R3).
 */
export function useAuthState(): AuthState {
  useEffect(startRestore, []);
  return useSyncExternalStore(subscribeAll, snapshot, () => "checking");
}

/** The signed-in user, from GET /me (cache key ["me"]). */
export function useMe() {
  const state = useAuthState();
  return useQuery({
    queryKey: ["me"],
    enabled: state === "signedIn",
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/me");
      if (error || !data) throw error ?? new Error("no user");
      return data;
    },
  });
}
