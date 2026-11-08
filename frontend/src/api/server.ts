import "server-only";
import createClient from "openapi-fetch";
import { apiInternalUrl } from "@/lib/server/upstream";
import type { paths } from "./schema";

/**
 * The server-side client for pages rendered on the server: search, listing and reviews (FR-022, research R14).
 * It sends no token at all, because tokens live only in the browser (R3, R4), and it never caches: search
 * answers depend on free dates that change every minute.
 */
export function serverApi() {
  return createClient<paths>({
    baseUrl: apiInternalUrl(),
    fetch: (request: Request) => fetch(request, { cache: "no-store" }),
  });
}
