import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { expectAccessible, renderIn } from "@/test/render";

const GET = vi.fn();
const push = vi.fn();
vi.mock("@/api/client", () => ({ api: { GET: (...args: unknown[]) => GET(...args) } }));
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ push }) }));

import { CityCombobox } from "./CityCombobox";
import { GuestPicker } from "./GuestPicker";
import { SearchForm } from "./SearchForm";

const tehran = {
  id: 7,
  name: "Tehran",
  timezone: "Asia/Tehran",
  country: { id: 11, code: "IR", name: "Iran" },
};
const shiraz = {
  id: 8,
  name: "Shiraz",
  timezone: "Asia/Tehran",
  country: { id: 11, code: "IR", name: "Iran" },
};

describe("CityCombobox (US1/AC1)", () => {
  beforeEach(() => {
    GET.mockReset();
  });

  it("suggests cities with their country in the page's language, and is chosen with the keyboard", async () => {
    GET.mockResolvedValue({ data: [tehran, shiraz] });
    const onChange = vi.fn();
    renderIn("fa", <CityCombobox onChange={onChange} />);
    const box = screen.getByRole("combobox", { name: "کجا" });
    await userEvent.type(box, "T");
    expect(await screen.findByRole("option", { name: /تهران/ })).toHaveTextContent("ایران");
    expect(GET).toHaveBeenCalledWith("/api/v1/cities", { params: { query: { q: "T", limit: 8 } } });
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenLastCalledWith({ id: 8, label: "شیراز", country: "IR" });
    expect(box).toHaveValue("شیراز");
  });

  it("finds a city typed in Persian, through its English name (feature 028)", async () => {
    const isfahan = { ...tehran, id: 9, name: "Isfahan" };
    GET.mockImplementation((_path: string, o: { params: { query: { q: string } } }) =>
      Promise.resolve({ data: o.params.query.q === "Isfahan" ? [isfahan] : [] }),
    );
    const onChange = vi.fn();
    renderIn("fa", <CityCombobox onChange={onChange} />);
    await userEvent.type(screen.getByRole("combobox"), "اصف");
    expect(await screen.findByRole("option", { name: /اصفهان/ })).toBeInTheDocument();
    expect(GET).toHaveBeenCalledWith("/api/v1/cities", { params: { query: { q: "Isfahan", limit: 8 } } });
    expect(GET).not.toHaveBeenCalledWith("/api/v1/cities", { params: { query: { q: "اصف", limit: 8 } } });
    await userEvent.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith({ id: 9, label: "اصفهان", country: "IR" });
  });

  it("finds a Persian name typed on an Arabic keyboard, on the English site too (feature 028)", async () => {
    GET.mockImplementation((_path: string, o: { params: { query: { q: string } } }) =>
      Promise.resolve({
        data: o.params.query.q === "Shiraz" ? [shiraz, { ...shiraz, id: 99, name: "Shirazeh" }] : [],
      }),
    );
    renderIn("en", <CityCombobox onChange={vi.fn()} />);
    await userEvent.type(screen.getByRole("combobox"), "شيرا"); // Arabic yeh
    expect(await screen.findByRole("option", { name: /Shiraz/ })).toHaveTextContent("Iran");
    expect(screen.getAllByRole("option")).toHaveLength(1); // "Shirazeh" is not «شیراز»
  });

  it("says so when no Persian name matches, without asking the API", async () => {
    renderIn("fa", <CityCombobox onChange={vi.fn()} />);
    await userEvent.type(screen.getByRole("combobox"), "قزوین");
    expect(await screen.findByText("شهری با این نام پیدا نشد.")).toBeInTheDocument();
    // Only the popular cities of the empty field were asked for (feature 030), no name search.
    const asked = GET.mock.calls.map(
      ([, o]) => (o as { params: { query: Record<string, unknown> } }).params.query,
    );
    expect(asked.every((query) => query.sort === "popular" && !("q" in query))).toBe(true);
  });

  it("suggests popular cities in an empty field, the language's own country first (feature 030)", async () => {
    const london = {
      ...tehran,
      id: 3,
      name: "London",
      country: { id: 6, code: "GB", name: "United Kingdom" },
    };
    GET.mockImplementation((_path: string, o: { params: { query: { country?: string } } }) =>
      Promise.resolve({ data: o.params.query.country === "IR" ? [shiraz, tehran] : [london, shiraz] }),
    );
    const onChange = vi.fn();
    renderIn("fa", <CityCombobox onChange={onChange} />);
    await userEvent.click(screen.getByRole("combobox"));
    const list = await screen.findByRole("listbox", { name: "مقصدهای پرطرفدار" });
    expect(
      within(list)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["شیرازایران", "تهرانایران", "لندنبریتانیا"]);
    expect(GET).toHaveBeenCalledWith("/api/v1/cities", {
      params: { query: { sort: "popular", limit: 6, country: "IR" } },
    });
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenLastCalledWith({ id: 3, label: "لندن", country: "GB" });
  });

  it("suggests the most booked cities on the English site, and hides them once typing starts", async () => {
    const london = {
      ...tehran,
      id: 3,
      name: "London",
      country: { id: 6, code: "GB", name: "United Kingdom" },
    };
    GET.mockImplementation((_path: string, o: { params: { query: { q?: string } } }) =>
      Promise.resolve({ data: o.params.query.q ? [tehran] : [london] }),
    );
    renderIn("en", <CityCombobox onChange={vi.fn()} />);
    const box = screen.getByRole("combobox");
    await userEvent.click(box);
    expect(await screen.findByRole("option", { name: /London/ })).toBeInTheDocument();
    expect(GET).toHaveBeenCalledWith("/api/v1/cities", { params: { query: { sort: "popular", limit: 6 } } });
    expect(GET).toHaveBeenCalledTimes(1); // no country of its own for English
    await userEvent.type(box, "Te");
    expect(await screen.findByRole("option", { name: /Tehran/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /London/ })).not.toBeInTheDocument();
  });

  it("says so when no city matches", async () => {
    GET.mockResolvedValue({ data: [] });
    renderIn("en", <CityCombobox onChange={vi.fn()} />);
    await userEvent.type(screen.getByRole("combobox"), "zz");
    expect(await screen.findByText("No city with this name.")).toBeInTheDocument();
  });

  it("is accessible", async () => {
    GET.mockResolvedValue({ data: [tehran] });
    const { container } = renderIn("fa", <CityCombobox onChange={vi.fn()} />);
    await userEvent.type(screen.getByRole("combobox"), "تهر");
    await screen.findByRole("option", { name: /تهران/ });
    await expectAccessible(container);
  });
});

describe("GuestPicker", () => {
  it("counts adults and children, keeps limits, and reads Persian digits", async () => {
    const onChange = vi.fn();
    renderIn(
      "fa",
      <GuestPicker value={{ adults: 1, children: 0, infants: 0, pets: 0 }} onChange={onChange} />,
    );
    await userEvent.click(screen.getByRole("button", { name: /مهمان‌ها/ }));
    expect(screen.getByRole("button", { name: "کم کردن بزرگسال" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "افزودن کودک" }));
    expect(onChange).toHaveBeenLastCalledWith({ adults: 1, children: 1, infants: 0, pets: 0 });
    expect(screen.getByText("زیر ۲ سال؛ در ظرفیت حساب نمی‌شود")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("بزرگسال"), { target: { value: "۳" } });
    expect(onChange).toHaveBeenLastCalledWith({ adults: 3, children: 0, infants: 0, pets: 0 });
  });

  it("is accessible", async () => {
    const { baseElement } = renderIn(
      "en",
      <GuestPicker value={{ adults: 2, children: 0, infants: 0, pets: 0 }} onChange={vi.fn()} />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Guests/ }));
    await expectAccessible(baseElement);
  });
});

describe("SearchForm", () => {
  beforeEach(() => push.mockReset());

  it("asks for a city first", async () => {
    renderIn("en", <SearchForm today="2026-11-08" />);
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Choose a city.");
    expect(push).not.toHaveBeenCalled();
  });

  it("opens the search with everything in the address (FR-020)", async () => {
    renderIn(
      "en",
      <SearchForm
        today="2026-11-08"
        initialCity={{ id: 7, label: "Tehran" }}
        initial={{ check_in: "2026-12-01", check_out: "2026-12-04", adults: 2, amenity_ids: [3] }}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        "/search?city_id=7&check_in=2026-12-01&check_out=2026-12-04&adults=2&amenity_ids=3",
      ),
    );
  });

  it("keeps a radius search from the map", async () => {
    renderIn("fa", <SearchForm today="2026-11-08" initial={{ lat: 35.7, lng: 51.4, radius_km: 3 }} />);
    await userEvent.click(screen.getByRole("button", { name: "جستجو" }));
    expect(push).toHaveBeenCalledWith("/search?lat=35.70000&lng=51.40000&radius_km=3&adults=1");
  });

  it("is accessible", async () => {
    const { container } = renderIn("fa", <SearchForm today="2026-11-08" />);
    await expectAccessible(container);
  });

  // specs/007-caravansara-theme, FR-005: a pill with a round button from md up, one line on a phone.
  it("is a pill with a round search button named for screen readers", () => {
    renderIn("fa", <SearchForm today="2026-11-08" />);
    const form = screen.getByRole("search");
    expect(form).toHaveClass("rounded-full", "md:grid");
    const button = screen.getByRole("button", { name: "جستجو" });
    expect(button).toHaveClass("rounded-full");
    expect(form).toContainElement(screen.getByRole("combobox", { name: "کجا" }));
  });

  it("opens the same fields from one line on a phone", async () => {
    renderIn("fa", <SearchForm today="2026-11-08" initialCity={{ id: 7, label: "تهران" }} />);
    const line = screen.getByRole("button", { name: /تهران/ });
    expect(line).toHaveClass("md:hidden");
    await userEvent.click(line);
    const dialog = await screen.findByRole("dialog", { name: "کجا می‌روید؟" });
    await userEvent.click(within(dialog).getByRole("button", { name: "جستجو" }));
    expect(push).toHaveBeenCalledWith("/search?city_id=7&adults=1");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
