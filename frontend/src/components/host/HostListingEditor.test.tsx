import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { expectAccessible, renderIn } from "@/test/render";
import { hostListing } from "./fixtures";

let query = "tab=details";
const replace = vi.fn();
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(query) }));
vi.mock("@/i18n/navigation", () => ({
  usePathname: () => "/host/listings/5",
  useRouter: () => ({ replace }),
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
let meId = 1;
vi.mock("@/hooks/useAuth", () => ({ useMe: () => ({ data: { id: meId }, isPending: false }) }));
const GET = vi.fn();
const POST = vi.fn();
const PATCH = vi.fn();
const PUT = vi.fn();
vi.mock("@/api/client", () => ({
  api: {
    GET: (...a: unknown[]) => GET(...a),
    POST: (...a: unknown[]) => POST(...a),
    PATCH: (...a: unknown[]) => PATCH(...a),
    PUT: (...a: unknown[]) => PUT(...a),
    DELETE: vi.fn(),
  },
}));
vi.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}));
vi.mock("next/image", () => ({
  default: (p: { src: string; alt: string }) => <img src={p.src} alt={p.alt} />,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

import { HostListingEditor } from "./HostListingEditor";

let listing = hostListing();
function serve() {
  GET.mockImplementation((path: string) => {
    if (path === "/api/v1/listings/{listing_id}")
      return Promise.resolve({ data: listing, response: new Response(null, { status: 200 }) });
    if (path === "/api/v1/amenities")
      return Promise.resolve({
        data: [
          {
            id: 1,
            name: "Essentials",
            amenities: [
              { id: 4, name: "Wifi", icon: null },
              { id: 6, name: "Kitchen", icon: null },
            ],
          },
        ],
      });
    if (path === "/api/v1/listings/{listing_id}/reviews")
      return Promise.resolve({
        data: {
          items: [
            {
              id: 1,
              booking_id: 1,
              listing_id: 5,
              author: { id: 2, full_name: "Sara", avatar_url: null },
              rating: 5,
              cleanliness_rating: 4,
              accuracy_rating: null,
              check_in_rating: null,
              communication_rating: null,
              location_rating: null,
              value_rating: null,
              comment: "عالی بود",
              created_at: "2026-01-02T10:00:00Z",
            },
          ],
          total: 1,
        },
      });
    return Promise.resolve({ data: { items: [], total: 0 } });
  });
}
const open = (tab = "details") => {
  query = `tab=${tab}`;
  return renderIn("fa", <HostListingEditor id={5} loadMap={() => Promise.reject(new Error("no map"))} />);
};
const save = () => userEvent.click(screen.getByRole("button", { name: "ذخیره‌ی تغییرها" }));

describe("HostListingEditor (specs/008-host-pages, US3)", () => {
  beforeEach(() => {
    [GET, POST, PATCH, PUT, replace].forEach((m) => m.mockReset());
    listing = hostListing();
    meId = 1;
    serve();
  });

  it("shows a rejection's reason and sends the listing again", async () => {
    listing = hostListing({
      review: { status: "rejected", rejection_reason: "عکس‌ها تار است", submitted_at: null },
    });
    POST.mockImplementation(async () => {
      listing = hostListing({ review: { status: "pending", rejection_reason: null, submitted_at: null } });
      return { data: listing };
    });
    open();
    expect(await screen.findByText("دلیل رد: عکس‌ها تار است")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "ارسال دوباره برای بازبینی" }));
    expect(POST).toHaveBeenCalledWith("/api/v1/listings/{listing_id}/resubmit", {
      params: { path: { listing_id: 5 } },
    });
    expect(await screen.findByText("در انتظار تأیید")).toBeInTheDocument(); // read again after the save
  });

  it("turns the listing off and on with no warning", async () => {
    PATCH.mockResolvedValue({ data: listing });
    open();
    await userEvent.click(await screen.findByRole("checkbox", { name: "نمایش در جستجو" }));
    expect(PATCH).toHaveBeenCalledWith("/api/v1/listings/{listing_id}", {
      params: { path: { listing_id: 5 } },
      body: { is_active: false },
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("saves price and capacity with no warning, sending only what changed", async () => {
    PATCH.mockResolvedValue({ data: listing });
    open();
    const price = await screen.findByRole("textbox", { name: "قیمت هر شب" });
    expect(price).toHaveValue("120");
    await userEvent.clear(price);
    await userEvent.type(price, "150");
    fireEvent.change(screen.getByRole("spinbutton", { name: "مهمان" }), { target: { value: "4" } });
    await save();
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() =>
      expect(PATCH).toHaveBeenCalledWith("/api/v1/listings/{listing_id}", {
        params: { path: { listing_id: 5 } },
        body: { price_per_night: "150", max_guests: 4 },
      }),
    );
    expect(PUT).not.toHaveBeenCalled();
  });

  it("warns before a title or amenity change on an approved listing; cancel sends nothing", async () => {
    PATCH.mockResolvedValue({ data: listing });
    PUT.mockResolvedValue({ data: listing });
    open();
    const title = await screen.findByRole("textbox", { name: "عنوان" });
    fireEvent.change(title, { target: { value: "خانه‌ی نو" } });
    await save();
    const dialog = await screen.findByRole("dialog", { name: "این تغییر بازبینی می‌خواهد" });
    await userEvent.click(within(dialog).getByRole("button", { name: "انصراف" }));
    expect(PATCH).not.toHaveBeenCalled();

    await userEvent.click(await screen.findByRole("checkbox", { name: "آشپزخانه" }));
    await save();
    await userEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "ذخیره و فرستادن برای بازبینی" }),
    );
    await waitFor(() => expect(PUT).toHaveBeenCalled());
    expect(PATCH.mock.calls[0]![1].body).toEqual({ title: "خانه‌ی نو" });
    expect(PUT).toHaveBeenCalledWith("/api/v1/listings/{listing_id}/amenities", {
      params: { path: { listing_id: 5 } },
      body: { amenity_ids: [4, 6] },
    });
  });

  it("warns on a pending listing never: it is not public yet", async () => {
    listing = hostListing({ review: { status: "pending", rejection_reason: null, submitted_at: null } });
    PATCH.mockResolvedValue({ data: listing });
    open();
    fireEvent.change(await screen.findByRole("textbox", { name: "عنوان" }), { target: { value: "نو" } });
    await save();
    await waitFor(() => expect(PATCH).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows the server's new status after a save, even if the admin decided meanwhile (L2)", async () => {
    PATCH.mockImplementation(async () => {
      listing = hostListing({
        is_active: true,
        price_per_night: "150.00",
        review: { status: "rejected", rejection_reason: "قیمت نادرست", submitted_at: null },
      });
      return { data: listing };
    });
    open();
    const price = await screen.findByRole("textbox", { name: "قیمت هر شب" });
    await userEvent.clear(price);
    await userEvent.type(price, "150");
    await save();
    expect(await screen.findByText("دلیل رد: قیمت نادرست")).toBeInTheDocument();
  });

  it("shows not found for another user's listing (R12)", async () => {
    meId = 2;
    open();
    expect(await screen.findByText("این صفحه پیدا نشد")).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).toBeNull();
  });

  it("keeps the tab in the address and shows the reviews with their ratings (US4/AC2)", async () => {
    open("reviews");
    expect(await screen.findByText("عالی بود")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "نظرها" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText(/۴٫۵/)).toBeInTheDocument();
    expect(screen.getByText("تمیزی")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "رزروها" }));
    expect(replace).toHaveBeenCalledWith("/host/listings/5?tab=bookings");
  });

  it("is accessible", async () => {
    open();
    await screen.findByRole("textbox", { name: "عنوان" });
    await expectAccessible(document.body);
  });
});
