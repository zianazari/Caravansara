import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expectAccessible } from "@/test/render";
import { CodeInput } from "./CodeInput";

function Example({ initial = "", disabled = false }: { initial?: string; disabled?: boolean }) {
  const [code, setCode] = useState(initial);
  return (
    <div dir="rtl">
      <label htmlFor="code">Code</label>
      <CodeInput id="code" value={code} onChange={setCode} disabled={disabled} />
    </div>
  );
}

it("shows five left-to-right slots and one accessible autofill control", async () => {
  const { container } = render(<Example />);
  const input = screen.getByRole("textbox", { name: "Code" });
  expect(screen.getAllByRole("textbox")).toHaveLength(1);
  expect(container.querySelectorAll("[data-code-slot]")).toHaveLength(5);
  expect(input.closest("[dir]")).toHaveAttribute("dir", "ltr");
  expect(input).toHaveAttribute("autocomplete", "one-time-code");
  expect(input).toHaveAttribute("inputmode", "numeric");
  await expectAccessible(container);
});

it("advances the active slot, normalizes digit sets and preserves leading zeroes", async () => {
  const { container } = render(<Example />);
  const user = userEvent.setup();
  await user.click(container.querySelector('[data-code-slot="0"]')!);
  await user.keyboard("۰١۲۳۴");
  expect(screen.getByLabelText("Code")).toHaveValue("01234");
  expect([...container.querySelectorAll("[data-code-slot]")].map((el) => el.textContent)).toEqual([
    "0",
    "1",
    "2",
    "3",
    "4",
  ]);
  expect(container.querySelector('[data-code-slot="4"]')).toHaveAttribute("data-active", "true");
});

it("pastes a complete code into any slot without mixing it with the old code", async () => {
  const { container } = render(<Example initial="12345" />);
  const user = userEvent.setup();
  await user.click(container.querySelector('[data-code-slot="2"]')!);
  await user.paste("۰ ۰ ۷ ۸ ۹");
  expect(screen.getByLabelText("Code")).toHaveValue("00789");
  expect(container.querySelector('[data-code-slot="4"]')).toHaveAttribute("data-active", "true");
  await user.paste("00789");
  await user.click(container.querySelector('[data-code-slot="1"]')!);
  await user.paste("۱۲");
  expect(screen.getByLabelText("Code")).toHaveValue("01289");
});

it("allows click-to-replace, arrow navigation and backspace", async () => {
  const { container } = render(<Example initial="12345" />);
  const user = userEvent.setup();
  await user.click(container.querySelector('[data-code-slot="2"]')!);
  await user.keyboard("9");
  expect(screen.getByLabelText("Code")).toHaveValue("12945");
  await user.keyboard("8");
  expect(screen.getByLabelText("Code")).toHaveValue("12985");
  await user.keyboard("{ArrowLeft}6");
  expect(screen.getByLabelText("Code")).toHaveValue("12965");
  await user.keyboard("{End}{Backspace}");
  expect(screen.getByLabelText("Code")).toHaveValue("1296");
  expect(container.querySelector('[data-code-slot="4"]')).toHaveAttribute("data-active", "true");
});

it("accepts a complete browser autofill and removes non-digits", () => {
  const { container } = render(<Example />);
  fireEvent.change(screen.getByLabelText("Code"), { target: { value: "۰۰۰۰۷" } });
  expect(screen.getByLabelText("Code")).toHaveValue("00007");
  fireEvent.change(screen.getByLabelText("Code"), { target: { value: "12x-3456" } });
  expect(screen.getByLabelText("Code")).toHaveValue("12345");
  expect(container.querySelectorAll("[data-code-slot]")).toHaveLength(5);
});

it("does not focus when disabled", async () => {
  const { container } = render(<Example disabled />);
  await userEvent.click(container.querySelector('[data-code-slot="0"]')!);
  expect(screen.getByLabelText("Code")).not.toHaveFocus();
  expect(screen.getByLabelText("Code")).toBeDisabled();
});
