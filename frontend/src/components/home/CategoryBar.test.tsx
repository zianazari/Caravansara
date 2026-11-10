import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { expectAccessible, renderIn } from "@/test/render";

const GET = vi.fn();
let search = new URLSearchParams();
vi.mock("@/api/client", () => ({ api: { GET: (...args: unknown[]) => GET(...args) } }));
vi.mock("next/navigation", () => ({ useSearchParams: () => search }));
vi.mock("@/i18n/navigation", () => ({
  usePathname: () => (search.has("city_id") ? "/search" : "/"),
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { CategoryBar } from "./CategoryBar";

const groups = [
  {
    id: 1,
    name: "Outdoor",
    amenities: [
      { id: 26, name: "Sauna", icon: "s" },
      { id: 27, name: "Balcony", icon: "b" },
    ],
  },
];

describe("CategoryBar (specs/007-caravansara-theme, US3)", () => {
  beforeEach(() => {
    GET.mockReset();
    GET.mockResolvedValue({ data: groups });
  });

  it("marks the category in the address as active, all by default", async () => {
    search = new URLSearchParams();
    renderIn("fa", <CategoryBar mode="home" />);
    await screen.findByRole("link", { name: "سونا" });
    expect(screen.getByRole("link", { name: "همه" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: "سونا" })).not.toHaveAttribute("aria-current");
  });

  it("on the home page, only changes ?category= so the city rows filter (R6)", async () => {
    search = new URLSearchParams("category=sauna");
    renderIn("fa", <CategoryBar mode="home" />);
    expect(await screen.findByRole("link", { name: "سونا" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: "بالکن" })).toHaveAttribute("href", "/?category=balcony");
    expect(screen.getByRole("link", { name: "همه" })).toHaveAttribute("href", "/");
  });

  it("on the search page, sets the search's own filters and starts from the first page", async () => {
    search = new URLSearchParams("city_id=7&adults=2&offset=20&amenity_ids=26&category=sauna");
    renderIn("fa", <CategoryBar mode="search" />);
    expect(await screen.findByRole("link", { name: "سونا" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: "بالکن" })).toHaveAttribute(
      "href",
      "/search?city_id=7&adults=2&category=balcony&amenity_ids=27",
    );
    expect(screen.getByRole("link", { name: "حیوان خانگی مجاز" })).toHaveAttribute(
      "href",
      "/search?city_id=7&adults=2&category=pets&pets=1",
    );
    expect(screen.getByRole("link", { name: "همه" })).toHaveAttribute("href", "/search?city_id=7&adults=2");
  });

  it("filters by place type with the search's own property_type, alone (feature 015)", async () => {
    search = new URLSearchParams("city_id=7&adults=2&amenity_ids=26&category=sauna");
    renderIn("fa", <CategoryBar mode="search" />);
    expect(await screen.findByRole("link", { name: "اتاق خصوصی" })).toHaveAttribute(
      "href",
      "/search?city_id=7&adults=2&category=private_room&property_type=private_room",
    );
  });

  it("marks a place type as active only while the search has just that filter", async () => {
    search = new URLSearchParams("city_id=7&property_type=entire_place&category=entire_place");
    const view = renderIn("fa", <CategoryBar mode="search" />);
    expect(await screen.findByRole("link", { name: "کل اقامتگاه" })).toHaveAttribute("aria-current", "true");
    view.unmount();
    search = new URLSearchParams("city_id=7&property_type=entire_place&amenity_ids=26&category=entire_place");
    renderIn("fa", <CategoryBar mode="search" />);
    expect(await screen.findByRole("link", { name: "همه" })).toHaveAttribute("aria-current", "true");
  });

  it("falls back to all when the filters no longer match the category", async () => {
    search = new URLSearchParams("city_id=7&amenity_ids=26&amenity_ids=27&category=sauna");
    renderIn("fa", <CategoryBar mode="search" />);
    await screen.findByRole("link", { name: "سونا" });
    expect(screen.getByRole("link", { name: "همه" })).toHaveAttribute("aria-current", "true");
  });

  it("moves between categories with the arrow keys, the way the text reads", async () => {
    search = new URLSearchParams();
    renderIn("fa", <CategoryBar mode="home" />);
    const all = await screen.findByRole("link", { name: "همه" });
    await waitFor(() => expect(screen.getByRole("link", { name: "سونا" })).toBeInTheDocument());
    all.focus();
    await userEvent.keyboard("{ArrowLeft}"); // right-to-left: left is the next one
    expect(screen.getByRole("link", { name: "کل اقامتگاه" })).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    expect(all).toHaveFocus();
  });

  it("is accessible", async () => {
    search = new URLSearchParams();
    const { container } = renderIn("fa", <CategoryBar mode="home" />);
    await screen.findByRole("link", { name: "سونا" });
    await expectAccessible(container);
  });
});
