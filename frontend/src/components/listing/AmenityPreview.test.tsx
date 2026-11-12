import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expectAccessible, renderIn } from "@/test/render";
import { AmenityPreview } from "./AmenityPreview";

const names = [
  "Wifi",
  "Kitchen",
  "Washer",
  "Dryer",
  "Heating",
  "TV",
  "Iron",
  "Hair dryer",
  "Shampoo",
  "Hot water",
  "Elevator",
  "Sauna",
];
const categories = [
  { id: 1, name: "Essentials", amenities: names.map((name, i) => ({ id: i + 1, name, icon: null })) },
];

describe("AmenityPreview (features 032, 040)", () => {
  it("shows ten amenities and opens the rest with «سایر امکانات»", async () => {
    renderIn("fa", <AmenityPreview categories={categories} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(10);
    expect(screen.queryByText("سونا")).toBeNull(); // the twelfth waits in the dialog
    await userEvent.click(screen.getByRole("button", { name: "سایر امکانات" }));
    expect(within(screen.getByRole("dialog")).getByText("سونا")).toBeInTheDocument();
    await expectAccessible(document.body);
  });

  it("has no button when ten or fewer amenities fit", () => {
    renderIn(
      "en",
      <AmenityPreview
        categories={[{ ...categories[0]!, amenities: categories[0]!.amenities.slice(0, 3) }]}
      />,
    );
    expect(screen.queryByRole("button", { name: "Other amenities" })).toBeNull();
  });
});
