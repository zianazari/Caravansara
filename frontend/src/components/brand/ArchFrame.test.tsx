import { fireEvent, screen } from "@testing-library/react";
import { renderIn } from "@/test/render";
import { ArchFrame } from "./ArchFrame";

vi.mock("next/image", () => ({
  // onError passes through, as next/image does, so a missing file can be simulated.
  default: (p: { src: string; alt: string; onError?: () => void }) => (
    <img src={p.src} alt={p.alt} onError={p.onError} />
  ),
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

  it("shows the default listing picture when there is no photo (feature 020)", () => {
    const { container } = renderIn("fa", <ArchFrame alt="بی عکس" />);
    expect(container.querySelector("[data-default-photo]")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "بی عکس" })).toBeInTheDocument();
  });

  it("shows the default picture instead of a broken image when the file cannot be loaded", () => {
    const { container } = renderIn("fa", <ArchFrame src="https://media.example/missing.jpg" alt="" />);
    const img = container.querySelector("img")!;
    fireEvent.error(img);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("[data-default-photo]")).toBeInTheDocument();
  });
});
