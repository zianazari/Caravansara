import { screen } from "@testing-library/react";
import { renderIn } from "@/test/render";
import { Logo } from "./Logo";

describe("Logo (feature 027)", () => {
  it("draws two nested arches on a base line, hidden from screen readers, next to the name", () => {
    const { container } = renderIn("fa", <Logo />);
    expect(screen.getByText("کاروانسرا")).toBeInTheDocument();
    const mark = container.querySelector("svg[data-logo='arches']")!;
    expect(mark).toHaveAttribute("aria-hidden");
    const paths = [...mark.querySelectorAll("path")].map((p) => p.getAttribute("class"));
    expect(paths).toEqual(["stroke-copper", "stroke-amber", "stroke-copper"]);
  });

  it("uses gold and amber on the admin panel's dark header", () => {
    const { container } = renderIn("en", <Logo onDark />);
    expect(screen.getByText("Caravansara").closest("span")).toHaveClass("text-gold");
    const paths = [...container.querySelectorAll("svg path")].map((p) => p.getAttribute("class"));
    expect(paths).toEqual(["stroke-gold", "stroke-amber", "stroke-gold"]);
  });
});
