import { screen } from "@testing-library/react";
import { renderIn } from "@/test/render";
import { ArchFrame } from "./ArchFrame";

vi.mock("next/image", () => ({
  default: (p: { src: string; alt: string }) => <img src={p.src} alt={p.alt} />,
}));

describe("ArchFrame", () => {
  it("shows the photo in a plain rounded frame by default (feature 017)", () => {
    const { container } = renderIn("fa", <ArchFrame src="https://media.example/p.jpg" alt="Garden flat" />);
    expect(screen.getByRole("img", { name: "Garden flat" })).toHaveAttribute(
      "src",
      "https://media.example/p.jpg",
    );
    expect(container.firstElementChild).toHaveClass("rounded-2xl");
    expect(container.firstElementChild).not.toHaveClass("arch");
  });

  it("uses the tall arch when asked", () => {
    const { container } = renderIn(
      "fa",
      <ArchFrame src="https://media.example/p.jpg" alt="" variant="tall" />,
    );
    expect(container.firstElementChild).toHaveClass("arch");
  });

  it("draws a warm placeholder, not a grey box, without a photo (US2/AC2)", () => {
    const { container } = renderIn("fa", <ArchFrame src={null} alt="بدون عکس" />);
    expect(screen.getByRole("img", { name: "بدون عکس" }).tagName.toLowerCase()).toBe("svg");
    expect(container.querySelector("img")).toBeNull();
  });

  it("hides a decorative placeholder from screen readers", () => {
    const { container } = renderIn("fa", <ArchFrame alt="" />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});
