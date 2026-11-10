import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { expectAccessible, renderIn } from "@/test/render";

// The address bar, as a tiny store: router.push changes ?step= and the page shows that step.
const nav = vi.hoisted(() => {
  let query = "step=1";
  const listeners = new Set<() => void>();
  return {
    push: vi.fn(),
    get: () => query,
    set(next: string) {
      query = next;
      listeners.forEach((f) => f());
    },
    subscribe(f: () => void) {
      listeners.add(f);
      return () => listeners.delete(f);
    },
  };
});
vi.mock("next/navigation", async () => {
  const React = await import("react");
  return { useSearchParams: () => new URLSearchParams(React.useSyncExternalStore(nav.subscribe, nav.get)) };
});
vi.mock("@/i18n/navigation", () => ({
  usePathname: () => "/host/new",
  useRouter: () => ({
    push: (url: string) => {
      nav.push(url);
      if (url.startsWith("/host/new?")) nav.set(url.split("?")[1]!);
    },
  }),
}));

const POST = vi.fn();
const PUT = vi.fn();
const uploadPhoto = vi.fn();
vi.mock("@/api/client", () => ({
  api: {
    GET: () => Promise.resolve({ data: [] }),
    POST: (...a: unknown[]) => POST(...a),
    PUT: (...a: unknown[]) => PUT(...a),
  },
}));
vi.mock("@/lib/photoUpload", async (original) => ({
  ...(await original<typeof import("@/lib/photoUpload")>()),
  uploadPhoto: (...a: unknown[]) => uploadPhoto(...a),
}));
vi.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}));
vi.mock("next/image", () => ({
  default: (p: { src: string; alt: string }) => <img src={p.src} alt={p.alt} />,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

import { ListingWizard } from "./ListingWizard";

const KEY = "cv-listing-draft";
const full = {
  property_type: "entire_place",
  city_id: 3,
  city_label: "آمستردام",
  country_code: "NL",
  address: "Keizersgracht 1",
  latitude: 52.37,
  longitude: 4.89,
  max_guests: 2,
  bedrooms: 1,
  beds: 1,
  bathrooms: 1,
  pets_allowed: false,
  max_pets: 0,
  amenity_ids: [4, 9],
  title: "خانه‌ی کنار کانال",
  currency: "EUR",
  price_per_night: "120",
  check_in_time: "15:00",
  check_out_time: "11:00",
};
const jpeg = (name: string) => {
  const bytes = new Uint8Array(64);
  bytes.set([0xff, 0xd8, 0xff, 0xe0]);
  return new File([bytes], name, { type: "image/jpeg" });
};

function open(step: number, draft?: object) {
  if (draft) sessionStorage.setItem(KEY, JSON.stringify(draft));
  nav.set(`step=${step}`);
  return renderIn("fa", <ListingWizard loadMap={() => Promise.reject(new Error("no map in tests"))} />);
}

async function threePhotosAndSend() {
  await userEvent.upload(screen.getByLabelText("انتخاب عکس‌ها"), [
    jpeg("a.jpg"),
    jpeg("b.jpg"),
    jpeg("c.jpg"),
  ]);
  await userEvent.click(await screen.findByRole("button", { name: "ارسال برای بازبینی" }));
}

describe("ListingWizard (specs/008-host-pages, US1)", () => {
  beforeEach(() => {
    sessionStorage.clear();
    [nav.push, POST, PUT, uploadPhoto].forEach((m) => m.mockReset());
    URL.createObjectURL = vi.fn(() => "blob:preview");
    URL.revokeObjectURL = vi.fn();
  });

  it("shows which of the eight steps it is and moves on when the answer is right", async () => {
    open(1);
    expect(screen.getByText("گام ۱ از ۸")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: /اتاق خصوصی/ }));
    await userEvent.click(screen.getByRole("button", { name: "بعدی" }));
    expect(nav.push).toHaveBeenLastCalledWith("/host/new?step=2");
    expect(await screen.findByText("گام ۲ از ۸")).toBeInTheDocument();
  });

  it("stays on a step with a wrong answer and says why next to the field", async () => {
    open(1);
    await userEvent.click(screen.getByRole("button", { name: "بعدی" }));
    expect(screen.getByRole("alert")).toHaveTextContent("این خانه را پر کنید.");
    expect(nav.push).not.toHaveBeenCalled();

    sessionStorage.clear();
    open(3, { ...full });
    const guests = screen.getAllByRole("spinbutton", { name: "مهمان" }).at(-1)!;
    fireEvent.change(guests, { target: { value: "0" } });
    await userEvent.click(screen.getAllByRole("button", { name: "بعدی" }).at(-1)!);
    expect(screen.getByText("عددی بین ۱ و ۵۰.")).toBeInTheDocument();
  });

  it("refuses a title over 200 characters", async () => {
    open(5, { ...full, title: "" });
    fireEvent.change(screen.getByRole("textbox", { name: "عنوان" }), { target: { value: "x".repeat(201) } });
    await userEvent.click(screen.getByRole("button", { name: "بعدی" }));
    expect(screen.getByText("حداکثر ۲۰۰ نویسه.")).toBeInTheDocument();
    expect(nav.push).not.toHaveBeenCalled();
  });

  it("goes back a step through the address", async () => {
    open(2, { property_type: "entire_place" });
    await userEvent.click(screen.getByRole("button", { name: "قبلی" }));
    expect(nav.push).toHaveBeenLastCalledWith("/host/new?step=1");
    expect(await screen.findByText("گام ۱ از ۸")).toBeInTheDocument();
  });

  it("keeps the answers in the tab's draft across a reload", async () => {
    const first = open(5, full);
    expect(screen.getByRole("textbox", { name: "عنوان" })).toHaveValue("خانه‌ی کنار کانال");
    fireEvent.change(screen.getByRole("textbox", { name: "عنوان" }), { target: { value: "خانه‌ی نو" } });
    first.unmount();
    open(5);
    expect(screen.getByRole("textbox", { name: "عنوان" })).toHaveValue("خانه‌ی نو");
  });

  it("keeps the usual answers when the host changes one field of a fresh form", async () => {
    const { max_guests, bedrooms, beds, bathrooms, pets_allowed, max_pets, ...noCapacity } = full;
    void [max_guests, bedrooms, beds, bathrooms, pets_allowed, max_pets];
    open(3, noCapacity);
    fireEvent.change(screen.getByRole("spinbutton", { name: "اتاق خواب" }), { target: { value: "2" } });
    await userEvent.click(screen.getByRole("button", { name: "بعدی" }));
    expect(nav.push).toHaveBeenLastCalledWith("/host/new?step=4");
  });

  it("does not show a later step whose earlier answers are missing", () => {
    open(6, { property_type: "entire_place" });
    expect(screen.getByText("گام ۲ از ۸")).toBeInTheDocument();
  });

  it("cannot send with fewer than three photos (Q1)", async () => {
    open(8, full);
    expect(screen.getByRole("button", { name: "ارسال برای بازبینی" })).toBeDisabled();
    expect(screen.getByText("دست‌کم ۳ عکس لازم است.")).toBeInTheDocument();
    await userEvent.upload(screen.getByLabelText("انتخاب عکس‌ها"), [jpeg("a.jpg"), jpeg("b.jpg")]);
    expect(screen.getByRole("button", { name: "ارسال برای بازبینی" })).toBeDisabled();
  });

  it("makes the listing, sends each photo, orders them, clears the draft and opens the listing (R3)", async () => {
    POST.mockResolvedValue({ data: { id: 7 } });
    PUT.mockResolvedValue({ data: [] });
    let next = 10;
    uploadPhoto.mockImplementation(async () => ({ id: ++next }));
    open(8, full);
    await threePhotosAndSend();

    await waitFor(() => expect(nav.push).toHaveBeenLastCalledWith("/host/listings/7"));
    expect(POST).toHaveBeenCalledTimes(1);
    expect(POST.mock.calls[0]![0]).toBe("/api/v1/listings");
    expect(POST.mock.calls[0]![1].body).toMatchObject({
      title: "خانه‌ی کنار کانال",
      city_id: 3,
      amenity_ids: [4, 9],
      price_per_night: "120",
      latitude: 52.37,
    });
    expect(uploadPhoto).toHaveBeenCalledTimes(3);
    expect(uploadPhoto.mock.calls.map((c) => c[0])).toEqual([7, 7, 7]);
    expect(uploadPhoto.mock.calls[0]![1].file.name).toBe("a.jpg");
    const order = PUT.mock.invocationCallOrder[0]!;
    expect(Math.max(...uploadPhoto.mock.invocationCallOrder)).toBeLessThan(order);
    expect(PUT).toHaveBeenCalledWith("/api/v1/listings/{listing_id}/photos/order", {
      params: { path: { listing_id: 7 } },
      body: { photo_ids: [11, 12, 13] },
    });
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it("keeps the made listing when a photo fails, offers to send it again, and never makes a second listing", async () => {
    POST.mockResolvedValue({ data: { id: 7 } });
    PUT.mockResolvedValue({ data: [] });
    uploadPhoto.mockImplementation(async (_id: number, p: { file: File }) => {
      if (p.file.name === "b.jpg") throw new Error("storage 500");
      return { id: p.file.name === "a.jpg" ? 21 : 23 };
    });
    open(8, full);
    await threePhotosAndSend();
    expect(await screen.findByText(/همه‌ی عکس‌ها آپلود نشدند/)).toBeInTheDocument();
    expect(JSON.parse(sessionStorage.getItem(KEY)!)).toMatchObject({ listing_id: 7 });
    expect(PUT).not.toHaveBeenCalled();

    uploadPhoto.mockResolvedValue({ id: 22 });
    await userEvent.click(screen.getByRole("button", { name: "دوباره" }));
    await waitFor(() => expect(nav.push).toHaveBeenLastCalledWith("/host/listings/7"));
    expect(POST).toHaveBeenCalledTimes(1);
    expect(uploadPhoto).toHaveBeenCalledTimes(4);
    expect(PUT.mock.calls[0]![1].body).toEqual({ photo_ids: [21, 22, 23] });
  });

  it("takes rial prices in toman and sends ten times the amount (R7)", async () => {
    POST.mockResolvedValue({ data: { id: 7 } });
    PUT.mockResolvedValue({ data: [] });
    uploadPhoto.mockResolvedValue({ id: 1 });
    open(6, { ...full, currency: "IRR", price_per_night: "" });
    expect(screen.getAllByText("تومان").length).toBeGreaterThan(0);
    await userEvent.type(screen.getByRole("textbox", { name: "قیمت هر شب" }), "۱۲۰٬۰۰۰");
    await userEvent.click(screen.getByRole("button", { name: "بعدی" }));
    await userEvent.click(await screen.findByRole("button", { name: "بعدی" }));
    await threePhotosAndSend();
    await waitFor(() => expect(POST).toHaveBeenCalled());
    expect(POST.mock.calls[0]![1].body).toMatchObject({ currency: "IRR", price_per_night: "1200000.00" });
  });

  it("puts the API's field error next to the field, on its own step (FR-015)", async () => {
    POST.mockResolvedValue({
      error: { error: { code: "validation_error", details: { fields: ["title"] } } },
    });
    open(8, full);
    await threePhotosAndSend();
    await waitFor(() => expect(nav.push).toHaveBeenLastCalledWith("/host/new?step=5"));
    expect(await screen.findByText("گام ۵ از ۸")).toBeInTheDocument();
    const title = screen.getByRole("textbox", { name: "عنوان" });
    expect(title).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("این مقدار درست نیست.")).toBeInTheDocument();
    expect(uploadPhoto).not.toHaveBeenCalled();
  });

  it("is accessible", async () => {
    open(2, { property_type: "entire_place" });
    await expectAccessible(document.body);
  });
});
