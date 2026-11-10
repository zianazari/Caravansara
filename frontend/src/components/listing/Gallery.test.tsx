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

  // specs/007-caravansara-theme, FR-007
  const three = [photo(1, 0, null), photo(2, 1, "Kitchen"), photo(3, 2, null)];

  it("shows the main photo in the lower caravansara arch", () => {
    const { container } = renderIn("fa", <Gallery title="Flat" photos={three} />);
    expect(container.querySelector("[data-arch='soft']")).toContainElement(screen.getByRole("img"));
  });

  it("has a dot for each photo that names it and jumps to it", async () => {
    renderIn("fa", <Gallery title="Flat" photos={three} />);
    const dots = screen.getAllByRole("button", { name: /^عکس \S+ از ۳$/ });
    expect(dots).toHaveLength(3);
    expect(dots[0]).toHaveAttribute("aria-current", "true");
    await userEvent.click(screen.getByRole("button", { name: "عکس ۳ از ۳" }));
    expect(screen.getByRole("img")).toHaveAttribute("src", "http://m/3.jpg");
    expect(screen.getByRole("button", { name: "عکس ۳ از ۳" })).toHaveAttribute("aria-current", "true");
  });

  it("moves with a swipe of more than 40 px, the other way round in right-to-left", () => {
    renderIn("fa", <Gallery title="Flat" photos={three} />);
    const figure = screen.getByRole("img").closest("figure")!;
    const swipe = (from: number, to: number) => {
      fireEvent.pointerDown(figure, { clientX: from, pointerId: 1 });
      fireEvent.pointerUp(figure, { clientX: to, pointerId: 1 });
    };
    swipe(100, 120); // too short
    expect(screen.getByRole("img")).toHaveAttribute("src", "http://m/1.jpg");
    swipe(100, 180); // to the right: the next photo in Persian
    expect(screen.getByRole("img")).toHaveAttribute("src", "http://m/2.jpg");
    swipe(180, 100); // back
    expect(screen.getByRole("img")).toHaveAttribute("src", "http://m/1.jpg");
  });

  it("swipes to the left for the next photo in English", () => {
    renderIn("en", <Gallery title="Flat" photos={three} />);
    const figure = screen.getByRole("img").closest("figure")!;
    fireEvent.pointerDown(figure, { clientX: 200, pointerId: 1 });
    fireEvent.pointerUp(figure, { clientX: 100, pointerId: 1 });
    expect(screen.getByRole("img")).toHaveAttribute("src", "http://m/2.jpg");
  });
});
