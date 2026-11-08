import { act, screen } from "@testing-library/react";
import { vi } from "vitest";
import { renderIn } from "@/test/render";
import { HoldCountdown } from "./HoldCountdown";

describe("HoldCountdown (FR-026)", () => {
  afterEach(() => vi.useRealTimers());

  it("ticks every second but announces only at 5 minutes, 1 minute and the end", () => {
    vi.useFakeTimers();
    const end = Date.now() + 6 * 60_000;
    const onExpire = vi.fn();
    renderIn("fa", <HoldCountdown remainingAt={() => Math.max(0, end - Date.now())} onExpire={onExpire} />);
    expect(screen.getByText("زمان باقی‌مانده برای پرداخت: ۰۶:۰۰")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("");

    act(() => vi.advanceTimersByTime(61_000));
    expect(screen.getByRole("status")).toHaveTextContent("۵ دقیقه تا پایان مهلت پرداخت");
    act(() => vi.advanceTimersByTime(30_000));
    expect(screen.getByRole("status")).toHaveTextContent("۵ دقیقه"); // no new announcement
    act(() => vi.advanceTimersByTime(4 * 60_000 - 30_000));
    expect(screen.getByRole("status")).toHaveTextContent("۱ دقیقه تا پایان مهلت پرداخت");
    expect(onExpire).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(61_000));
    expect(screen.getByRole("status")).toHaveTextContent("مهلت پرداخت تمام شد.");
    expect(onExpire).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(5_000));
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it("is over at once when the hold has already ended", () => {
    const onExpire = vi.fn();
    renderIn("en", <HoldCountdown remainingAt={() => 0} onExpire={onExpire} />);
    expect(screen.getAllByText("The time to pay has run out.").length).toBeGreaterThan(0);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });
});
