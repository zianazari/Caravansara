import "server-only";

/** Where the API answers inside the deployment (`http://api:8000` in docker compose); read at run time. */
export function apiInternalUrl(): string {
  return (process.env.API_INTERNAL_URL ?? "http://localhost:8000").replace(/\/+$/, "");
}

/**
 * The visitor's address, sent to the API in X-Forwarded-For so the login and sign-up rate limits count each
 * person apart (research R19). The API trusts this header only from the site's fixed address.
 *
 * The rightmost entry is the one the nearest proxy added. Next.js fills the header from the connection only
 * when it is missing (`??=` in next/dist/server/base-server.js), so without a reverse proxy in front of the
 * site a visitor can send their own value. Production therefore runs behind a proxy that sets the header;
 * docker compose for development does not (docs/backend-design.md, web front-end).
 */
export function clientAddress(headers: Headers): string | undefined {
  const chain = headers.get("x-forwarded-for");
  if (!chain) return undefined;
  const last = chain.split(",").at(-1)?.trim();
  return last || undefined;
}
