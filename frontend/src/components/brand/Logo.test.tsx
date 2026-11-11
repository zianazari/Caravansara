import { screen } from "@testing-library/react";
import { renderIn } from "@/test/render";
import { Footer } from "@/components/layout/Footer";
import { Logo, LogoMark } from "./Logo";

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

  it("draws the same mark alone, in sand for an empty page (feature 036)", () => {
    const { container } = renderIn("fa", <LogoMark tone="muted" />);
    const paths = [...container.querySelectorAll("svg[data-logo='arches'] path")].map((p) =>
      p.getAttribute("class"),
    );
    expect(paths).toEqual(["stroke-sand-strong", "stroke-sand-strong", "stroke-sand-strong"]);
  });

  it("puts the mark in gold next to the name in the footer (feature 036)", () => {
    const { container } = renderIn("fa", <Footer />);
    const paths = [...container.querySelectorAll("footer svg[data-logo='arches'] path")].map((p) =>
      p.getAttribute("class"),
    );
    expect(paths).toEqual(["stroke-gold", "stroke-amber", "stroke-gold"]);
  });
});
