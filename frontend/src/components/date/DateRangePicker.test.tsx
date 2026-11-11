import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { vi } from "vitest";
import { expectAccessible, renderIn } from "@/test/render";
import { DateRangePicker } from "./DateRangePicker";

function Harness({
  onChange,
  initial = {},
}: {
  onChange: (v: unknown) => void;
  initial?: { checkIn?: string; checkOut?: string };
}) {
  const [value, setValue] = useState(initial);
  return (
    <DateRangePicker
      value={value}
      min="2026-03-21"
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

describe("DateRangePicker", () => {
  it("picks dates in the Jalali calendar and sends Gregorian dates (FR-005)", async () => {
    const onChange = vi.fn();
    renderIn("fa", <Harness onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /تاریخ سفر/ }));
    expect(screen.getByText(/فروردین ۱۴۰۵/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "۱ فروردین ۱۴۰۵" }));
    await userEvent.click(screen.getByRole("button", { name: "۵ فروردین ۱۴۰۵" }));
    expect(onChange).toHaveBeenLastCalledWith({ checkIn: "2026-03-21", checkOut: "2026-03-25" });
  });

  it("shows the weekly day off in red: Friday in Persian, Sunday in English (feature 038)", async () => {
    const { unmount } = renderIn("fa", <Harness onChange={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /تاریخ سفر/ }));
    expect(screen.getByRole("button", { name: "۷ فروردین ۱۴۰۵" })).toHaveClass("text-destructive"); // Friday
    expect(screen.getByRole("button", { name: "۸ فروردین ۱۴۰۵" })).not.toHaveClass("text-destructive");
    const fa = screen.getAllByRole("columnheader");
    expect(fa.at(-1)).toHaveClass("text-destructive"); // the week ends on Friday
    unmount();

    renderIn("en", <Harness onChange={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /Dates/ }));
    expect(screen.getByRole("button", { name: "22 March 2026" })).toHaveClass("text-destructive"); // Sunday
    expect(screen.getByRole("button", { name: "27 March 2026" })).not.toHaveClass("text-destructive");
    expect(screen.getAllByRole("columnheader").at(-1)).toHaveClass("text-destructive"); // Monday to Sunday
  });

  it("uses the Gregorian calendar on English pages", async () => {
    const onChange = vi.fn();
    renderIn("en", <Harness onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /Dates/ }));
    expect(screen.getByText("March 2026")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "22 March 2026" }));
    expect(onChange).toHaveBeenLastCalledWith({ checkIn: "2026-03-22", checkOut: undefined });
  });

  it("does not offer days before the first allowed day", async () => {
    renderIn("en", <Harness onChange={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /Dates/ }));
    expect(screen.getByRole("button", { name: "20 March 2026" })).toBeDisabled();
  });

  it("starts again when the second day is not after the first", async () => {
    const onChange = vi.fn();
    renderIn("en", <Harness onChange={onChange} initial={{ checkIn: "2026-03-25" }} />);
    await userEvent.click(screen.getByRole("button", { name: /Dates/ }));
    await userEvent.click(screen.getByRole("button", { name: "23 March 2026" }));
    expect(onChange).toHaveBeenLastCalledWith({ checkIn: "2026-03-23", checkOut: undefined });
  });

  it("moves with the keyboard; left and right follow the reading direction", async () => {
    const onChange = vi.fn();
    renderIn("fa", <Harness onChange={onChange} initial={{ checkIn: "2026-03-25" }} />);
    await userEvent.click(screen.getByRole("button", { name: /تاریخ سفر/ }));
    const grid = screen.getByRole("grid");
    fireEvent.keyDown(grid, { key: "ArrowLeft" }); // right-to-left: the next day
    fireEvent.keyDown(grid, { key: "ArrowDown" }); // a week later
    expect(within(grid).getByRole("button", { name: "۱۳ فروردین ۱۴۰۵" })).toHaveFocus();
    fireEvent.keyDown(grid, { key: "PageDown" }); // about a month later
    expect(within(grid).getByRole("button", { name: "۱۲ اردیبهشت ۱۴۰۵" })).toHaveFocus();
    fireEvent.keyDown(grid, { key: "PageUp" });
    fireEvent.keyDown(grid, { key: "Enter" });
    expect(onChange).toHaveBeenLastCalledWith({ checkIn: "2026-03-25", checkOut: "2026-04-02" });
  });

  it("is accessible", async () => {
    const { baseElement } = renderIn("fa", <Harness onChange={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /تاریخ سفر/ }));
    await expectAccessible(baseElement);
  });
});
