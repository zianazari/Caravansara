import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { renderIn } from "@/test/render";
import { Gallery } from "./Gallery";

vi.mock("next/image", () => ({
  default: (p: { src: string; alt: string }) => <img src={p.src} alt={p.alt} />,
}));

const photo = (id: number, sort_order: number, room_tag: string | null) => ({
  id,
  sort_order,
  room_tag,
  caption: null,
  url: `http://m/${id}.jpg`,
  storage_key: String(id),
  width: 1,
  height: 1,
});

describe("Gallery", () => {
  it("starts with the cover and moves with buttons and arrow keys in the reading direction", async () => {
    renderIn(
      "fa",
      <Gallery title="Flat" photos={[photo(2, 1, "Kitchen"), photo(1, 0, null), photo(3, 2, null)]} />,
    );
    expect(screen.getByRole("img")).toHaveAttribute("src", "http://m/1.jpg");
    expect(screen.getByText("عکس ۱ از ۳")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "عکس بعدی" }));
    expect(screen.getByText("Kitchen")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("region", { name: "عکس‌ها" }), { key: "ArrowLeft" }); // forward in RTL
    expect(screen.getByRole("img")).toHaveAttribute("src", "http://m/3.jpg");
    await userEvent.click(screen.getByRole("button", { name: "عکس بعدی" }));
    expect(screen.getByRole("img")).toHaveAttribute("src", "http://m/1.jpg");
  });

  it("shows a placeholder without photos", () => {
    renderIn("en", <Gallery title="Flat" photos={[]} />);
    expect(screen.queryByRole("img")).toBeNull();
  });
});
