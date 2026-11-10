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

  it("shows the default listing picture, labelled as a sample, when there is no photo (feature 020)", () => {
    const { container } = renderIn("fa", <ArchFrame alt="بی عکس" />);
    expect(container.querySelector("[data-default-photo]")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "بی عکس" })).toBeInTheDocument();
    expect(screen.getByText("تصویر نمونه")).toBeInTheDocument();
  });

  it("shows the default picture instead of a broken image when the file cannot be loaded", () => {
    const { container } = renderIn("fa", <ArchFrame src="https://media.example/missing.jpg" alt="" />);
    const img = container.querySelector("img")!;
    expect(img).toHaveAttribute("src", "https://media.example/missing.jpg");
    fireEvent.error(img);
    expect(container.querySelector('img[src="https://media.example/missing.jpg"]')).toBeNull();
    expect(container.querySelector("[data-default-photo]")).toBeInTheDocument();
  });
});
