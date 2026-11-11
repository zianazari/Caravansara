import { screen } from "@testing-library/react";
import { vi } from "vitest";
import { renderIn } from "@/test/render";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("city_id=3") }));
vi.mock("@/i18n/navigation", () => ({
  usePathname: () => "/search",
  Link: ({
    href,
    children,
    locale,
    ...rest
  }: {
    href: string;
    locale: string;
    children: React.ReactNode;
  }) => (
    <a href={`/${locale}${href}`} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/image", () => ({
  default: (p: { src: { src: string }; alt: string; "data-flag": string }) => (
    <img src={p.src.src} alt={p.alt} aria-hidden data-flag={p["data-flag"]} />
  ),
}));

import { LocaleSwitch } from "./LocaleSwitch";

describe("LocaleSwitch (feature 046)", () => {
  it("shows the United Kingdom's flag beside «English» on the Persian site, keeping the page and search", () => {
    const { container } = renderIn("fa", <LocaleSwitch />);
    const link = screen.getByRole("link", { name: "English" }); // the flag is decoration, not part of the name
    expect(link).toHaveAttribute("href", "/en/search?city_id=3");
    expect(container.querySelector("img[data-flag='en']")).toHaveAttribute("aria-hidden");
  });

  it("shows Iran's flag beside «فارسی» on the English site", () => {
    const { container } = renderIn("en", <LocaleSwitch />);
    expect(screen.getByRole("link", { name: "فارسی" })).toBeInTheDocument();
    expect(container.querySelector("img[data-flag='fa']")).not.toBeNull();
  });
});
