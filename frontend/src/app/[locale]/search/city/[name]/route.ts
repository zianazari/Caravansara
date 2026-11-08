import { redirect } from "next/navigation";
import { serverApi } from "@/api/server";

/**
 * A suggested city on the home page links here by name; the city's id comes from GET /cities, and the visitor
 * goes on to the normal search address. This keeps ids out of the page source, as they differ per database.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string; name: string }> },
) {
  const { locale, name } = await params;
  const { data } = await serverApi().GET("/api/v1/cities", { params: { query: { q: name, limit: 1 } } });
  const city = data?.[0];
  redirect(city ? `/${locale}/search?city_id=${city.id}&adults=1` : `/${locale}`);
}
