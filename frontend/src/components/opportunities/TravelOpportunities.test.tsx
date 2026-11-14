import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { expectAccessible, renderIn } from "@/test/render";
import type { components } from "@/api/schema";
import { TravelOpportunities } from "./TravelOpportunities";
import { OpportunityCard } from "./OpportunityCard";
import { OpportunityInvite } from "./OpportunityInvite";

const GET = vi.fn();
vi.mock("@/api/client", () => ({ api: { GET: (...args: unknown[]) => GET(...args) } }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: React.ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const item: components["schemas"]["TravelOpportunity"] = {
  kind: "flexible",
  listing: {
    id: 123,
    title: "A quiet cabin",
    property_type: "entire_place",
    city: "Tehran",
    country_code: "IR",
    pin: { lat: 35, lng: 51 },
    distance_km: null,
    avg_rating: "4.9",
    review_count: 12,
    max_guests: 4,
    price_per_night: "20000000",
    cleaning_fee: "5000000",
    currency: "IRR",
    total_price: "65000000",
    cover_url: null,
  },
  check_in: "2027-01-07",
  check_out: "2027-01-10",
  nights: 3,
  stay_total: "60000000",
  cleaning_fee: "5000000",
  total_price: "65000000",
  shift_days: -3,
  reference_total: "80000000",
  savings: "15000000",
};
const query = {
  budget: "100000000",
  currency: "IRR",
  preferred_check_in: "2027-01-10",
  adults: 2,
  children: 1,
  infants: 2,
  pets: 1,
};

beforeEach(() => {
  GET.mockReset();
  GET.mockImplementation((path: string) =>
    Promise.resolve({
      data:
        path === "/api/v1/countries"
          ? [{ code: "IR" }, { code: "NL" }]
          : { items: [item], matched_listings: 1 },
    }),
  );
});

it.each(["fa", "en"] as const)("shows an accessible separate search in %s", async (locale) => {
  const { container } = renderIn(locale, <TravelOpportunities today="2027-01-01" />);
  await waitFor(() =>
    expect(
      screen.getByRole("option", { name: locale === "fa" ? "هلند" : "Netherlands", hidden: true }),
    ).toBeInTheDocument(),
  );
  expect(GET).not.toHaveBeenCalledWith("/api/v1/search/listings", expect.anything());
  expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  await expectAccessible(container);
});

it("sends an exact rial budget, keeps stale results clearly marked, and transfers guests", async () => {
  renderIn("en", <TravelOpportunities today="2027-01-01" />);
  fireEvent.change(screen.getByLabelText("Total accommodation budget (Toman)"), {
    target: { value: "۱۰٬۰۰۰٬۰۰۰" },
  });
  await userEvent.click(screen.getByRole("button", { name: "Find my travel opportunities" }));
  expect(await screen.findByRole("heading", { name: "A quiet cabin" })).toBeInTheDocument();
  expect(GET).toHaveBeenCalledWith(
    "/api/v1/search/opportunities",
    expect.objectContaining({
      params: {
        query: expect.objectContaining({
          budget: "100000000",
          country: "IR",
          currency: "IRR",
          preferred_check_in: "2027-01-08",
          nights: 3,
          flex_days: 3,
        }),
      },
    }),
  );
  expect(screen.getByRole("link", { name: "View and book A quiet cabin" })).toHaveAttribute(
    "href",
    expect.stringContaining("check_in=2027-01-07&check_out=2027-01-10&adults=2&children=0&infants=0&pets=0"),
  );
  fireEvent.change(screen.getByLabelText("Total accommodation budget (Toman)"), {
    target: { value: "5000000" },
  });
  expect(screen.getByText(/Your choices have changed/)).toBeInTheDocument();
});

it("validates budgets before fetching and handles empty results", async () => {
  GET.mockImplementation((path: string) =>
    Promise.resolve({ data: path === "/api/v1/countries" ? [] : { items: [], matched_listings: 0 } }),
  );
  renderIn("en", <TravelOpportunities today="2027-01-01" />);
  fireEvent.change(screen.getByLabelText("Total accommodation budget (Toman)"), { target: { value: "0" } });
  await userEvent.click(screen.getByRole("button", { name: "Find my travel opportunities" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid budget");
  expect(GET.mock.calls.filter(([path]) => path.includes("opportunities"))).toHaveLength(0);
  await userEvent.click(screen.getByRole("button", { name: "5,000,000 Toman" }));
  await userEvent.click(screen.getByRole("button", { name: "Find my travel opportunities" }));
  expect(await screen.findByText("No opportunities in this budget yet")).toBeInTheDocument();
});

it("handles request failure and retries", async () => {
  GET.mockImplementation((path: string) =>
    Promise.resolve(path === "/api/v1/countries" ? { data: [] } : { error: {} }),
  );
  renderIn("en", <TravelOpportunities today="2027-01-01" />);
  await userEvent.click(screen.getByRole("button", { name: "Find my travel opportunities" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("We could not load");
  GET.mockResolvedValue({ data: { items: [], matched_listings: 0 } });
  await userEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText("No opportunities in this budget yet")).toBeInTheDocument();
});

it("renders real savings and a transparent price breakdown with booking parameters", async () => {
  const { container } = renderIn("fa", <OpportunityCard item={item} query={query} />);
  expect(screen.getByText("۱٬۵۰۰٬۰۰۰ تومان صرفه‌جویی")).toBeInTheDocument();
  await userEvent.click(screen.getByText("شامل اقامت و نظافت · جزئیات"));
  expect(screen.getByText("۶٬۰۰۰٬۰۰۰ تومان")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "دیدن و رزرو A quiet cabin" })).toHaveAttribute(
    "href",
    expect.stringContaining("adults=2&children=1&infants=2&pets=1"),
  );
  await expectAccessible(container);
});

it("links from the home invitation into the optional feature", () => {
  renderIn("en", <OpportunityInvite />);
  expect(screen.getByRole("link")).toHaveAttribute("href", "/opportunities");
});

it("lets the guest scope another country and currency without conversion", async () => {
  renderIn("en", <TravelOpportunities today="2027-01-01" />);
  await screen.findByRole("option", { name: "Netherlands", hidden: true });
  await userEvent.click(screen.getByText("Iran · Toman — change destination and currency"));
  await userEvent.selectOptions(screen.getByLabelText("Which country?"), "NL");
  expect(screen.getByLabelText("Budget currency")).toHaveValue("EUR");
  fireEvent.change(screen.getByLabelText("Total accommodation budget (EUR)"), {
    target: { value: "600.25" },
  });
  await userEvent.selectOptions(screen.getByLabelText("How many nights?"), "2");
  await userEvent.selectOptions(screen.getByLabelText("Date flexibility"), "0");
  await userEvent.click(screen.getByRole("button", { name: "Find my travel opportunities" }));
  await screen.findByRole("heading", { name: "A quiet cabin" });
  expect(GET).toHaveBeenCalledWith(
    "/api/v1/search/opportunities",
    expect.objectContaining({
      params: {
        query: expect.objectContaining({
          country: "NL",
          currency: "EUR",
          budget: "600.25",
          nights: 2,
          flex_days: 0,
        }),
      },
    }),
  );
});
