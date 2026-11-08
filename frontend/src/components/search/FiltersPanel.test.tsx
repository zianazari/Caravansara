import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { parseSearch } from "@/lib/searchParams";
import { expectAccessible, renderIn } from "@/test/render";

const GET = vi.fn();
vi.mock("@/api/client", () => ({ api: { GET: (...args: unknown[]) => GET(...args) } }));
import { FiltersPanel } from "./FiltersPanel";

const filters = {
  total: 40,
  amenities: [
    { id: 18, name: "Wifi", category: "Internet and office", listings: 31 },
    { id: 17, name: "Dedicated workspace", category: "Internet and office", listings: 12 },
    { id: 24, name: "Kitchen", category: "Kitchen and dining", listings: 25 },
  ],
};

describe("FiltersPanel (US1/AC3)", () => {
  beforeEach(() => GET.mockReset().mockResolvedValue({ data: filters }));

  it("shows grouped, translated amenities with the number of places for each", async () => {
    renderIn("fa", <FiltersPanel state={parseSearch({ city_id: "1", adults: "2" })} onApply={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /امکانات/ }));
    expect(await screen.findByRole("group", { name: "اینترنت و کار" })).toBeInTheDocument();
    expect(screen.getByText("وای‌فای")).toBeInTheDocument();
    expect(screen.getByText("۳۱ اقامتگاه")).toBeInTheDocument();
    expect(GET).toHaveBeenCalledWith("/api/v1/search/filters", {
      params: { query: expect.objectContaining({ city_id: 1, adults: 2, amenity_ids: [] }) },
    });
  });

  it("applies the chosen amenities together", async () => {
    const onApply = vi.fn();
    renderIn("en", <FiltersPanel state={parseSearch({ city_id: "1" })} onApply={onApply} />);
    await userEvent.click(screen.getByRole("button", { name: /Amenities/ }));
    await userEvent.click(await screen.findByRole("checkbox", { name: /Kitchen/ }));
    await userEvent.click(screen.getByRole("checkbox", { name: /Wifi/ }));
    await userEvent.click(screen.getByRole("button", { name: "Show results" }));
    expect(onApply).toHaveBeenCalledWith([18, 24]);
  });

  it("is accessible", async () => {
    const { baseElement } = renderIn(
      "fa",
      <FiltersPanel state={parseSearch({ city_id: "1" })} onApply={vi.fn()} />,
    );
    await userEvent.click(screen.getByRole("button", { name: /امکانات/ }));
    await screen.findByText("وای‌فای");
    await expectAccessible(baseElement);
  });
});
