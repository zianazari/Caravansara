import { screen } from "@testing-library/react";
import { vi } from "vitest";
import { expectAccessible, renderIn } from "@/test/render";

const GET = vi.fn();
vi.mock("@/api/client", () => ({ api: { GET: (...a: unknown[]) => GET(...a) } }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/image", () => ({
  default: (p: { src: string; alt: string }) => <img src={p.src} alt={p.alt} />,
}));

import { TripListing } from "./TripListing";

const photo = (id: number) => ({
  id,
  sort_order: id - 1,
  room_tag: null,
  caption: null,
  url: `http://m/${id}.jpg`,
  storage_key: String(id),
  width: 1,
  height: 1,
});

describe("TripListing (feature 022)", () => {
  beforeEach(() => GET.mockReset());

  it("shows the booked place's photos and links back to its listing", async () => {
    GET.mockResolvedValue({ data: { id: 5, photos: [1, 2, 3, 4, 5].map(photo) } });
    renderIn("fa", <TripListing listingId={5} title="Garden house" />);
    expect(await screen.findByRole("link", { name: "مشاهده‌ی آگهی" })).toHaveAttribute("href", "/listings/5");
    expect(screen.getByRole("button", { name: "نمایش همه‌ی عکس‌ها" })).toBeInTheDocument();
    expect(GET).toHaveBeenCalledWith("/api/v1/listings/{listing_id}", {
      params: { path: { listing_id: 5 } },
    });
    await expectAccessible(document.body);
  });

  it("says so when the listing is no longer shown", async () => {
    GET.mockResolvedValue({ data: undefined, error: { error: { code: "not_found" } } });
    renderIn("fa", <TripListing listingId={5} title="Garden house" />);
    expect(await screen.findByText("این آگهی دیگر نمایش داده نمی‌شود.")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
