import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { vi } from "vitest";
import { expectAccessible, renderIn } from "@/test/render";

const PUT = vi.fn();
const PATCH = vi.fn();
const DELETE = vi.fn();
const uploadPhoto = vi.fn();
vi.mock("@/api/client", () => ({
  api: {
    PUT: (...a: unknown[]) => PUT(...a),
    PATCH: (...a: unknown[]) => PATCH(...a),
    DELETE: (...a: unknown[]) => DELETE(...a),
  },
}));
vi.mock("@/lib/photoUpload", async (original) => ({
  ...(await original<typeof import("@/lib/photoUpload")>()),
  uploadPhoto: (...a: unknown[]) => uploadPhoto(...a),
}));
vi.mock("next/image", () => ({
  default: (p: { src: string; alt: string }) => <img src={p.src} alt={p.alt} />,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

import { PhotoManager } from "./PhotoManager";

const photo = (id: number, sort_order: number, room_tag: string | null = null) => ({
  id,
  sort_order,
  room_tag,
  caption: null,
  url: `http://m/${id}.jpg`,
  storage_key: `listings/4/${id}.jpg`,
  width: 800,
  height: 600,
});
const jpeg = (name = "a.jpg", size = 64) => {
  const bytes = new Uint8Array(size);
  bytes.set([0xff, 0xd8, 0xff, 0xe0]);
  return new File([bytes], name, { type: "image/jpeg" });
};

function setup(status = "pending", photos = [photo(1, 0), photo(2, 1, "Bedroom"), photo(3, 2)]) {
  const onChange = vi.fn();
  renderIn("fa", <PhotoManager listingId={4} photos={photos} reviewStatus={status} onChange={onChange} />);
  return onChange;
}

describe("PhotoManager (specs/008-host-pages, US2)", () => {
  beforeEach(() => {
    [PUT, PATCH, DELETE, uploadPhoto].forEach((m) => m.mockReset());
    URL.createObjectURL = vi.fn(() => "blob:preview");
    URL.revokeObjectURL = vi.fn();
  });

  it("refuses a bad file before sending anything (SC-002)", async () => {
    setup();
    const input = screen.getByLabelText("انتخاب عکس‌ها");
    await userEvent.upload(input, [jpeg("big.jpg", 10 * 1024 * 1024 + 1)], { applyAccept: false });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "big.jpg: هر عکس حداکثر ۱۰ مگابایت می‌تواند باشد.",
    );
    await userEvent.upload(input, [new File(["text"], "fake.jpg", { type: "image/jpeg" })], {
      applyAccept: false,
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("fake.jpg: این فایل عکس نیست.");
    expect(uploadPhoto).not.toHaveBeenCalled();
  });

  it("uploads each photo with its own progress; a failure gets a retry and does not stop the others", async () => {
    uploadPhoto.mockImplementation(
      async (_id: number, p: { file: File }, o: { onProgress: (f: number) => void }) => {
        o.onProgress(0.5);
        if (p.file.name === "bad.jpg") throw new Error("storage 500");
        return photo(9, 3);
      },
    );
    const onChange = setup();
    await userEvent.upload(screen.getByLabelText("انتخاب عکس‌ها"), [jpeg("good.jpg"), jpeg("bad.jpg")]);
    await waitFor(() => expect(uploadPhoto).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("آپلود نشد.")).toBeInTheDocument();
    expect(onChange).toHaveBeenCalled();
    uploadPhoto.mockResolvedValue(photo(10, 4));
    await userEvent.click(screen.getByRole("button", { name: "دوباره" }));
    await waitFor(() => expect(uploadPhoto).toHaveBeenCalledTimes(3));
  });

  it("moves photos with the buttons and makes one the cover, sending every id, cover first", async () => {
    PUT.mockResolvedValue({ data: [] });
    setup();
    const second = screen.getByRole("group", { name: "عکس ۲" });
    await userEvent.click(within(second).getByRole("button", { name: "جلوتر" }));
    expect(PUT).toHaveBeenLastCalledWith("/api/v1/listings/{listing_id}/photos/order", {
      params: { path: { listing_id: 4 } },
      body: { photo_ids: [2, 1, 3] },
    });
    await userEvent.click(
      within(screen.getByRole("group", { name: "عکس ۳" })).getByRole("button", { name: "کاور کن" }),
    );
    expect(PUT).toHaveBeenLastCalledWith("/api/v1/listings/{listing_id}/photos/order", {
      params: { path: { listing_id: 4 } },
      body: { photo_ids: [3, 2, 1] }, // after the first move the order is 2, 1, 3
    });
  });

  it("shows a photo added after a reorder: the server's new list wins", async () => {
    PUT.mockResolvedValue({ data: [] });
    function Reloading() {
      const [photos, setPhotos] = useState([photo(1, 0), photo(2, 1), photo(3, 2)]);
      return (
        <>
          <button
            type="button"
            onClick={() => setPhotos([photo(3, 0), photo(1, 1), photo(2, 2), photo(9, 3)])}
          >
            reload
          </button>
          <PhotoManager listingId={4} photos={photos} reviewStatus="pending" onChange={vi.fn()} />
        </>
      );
    }
    renderIn("fa", <Reloading />);
    await userEvent.click(
      within(screen.getByRole("group", { name: "عکس ۳" })).getByRole("button", { name: "کاور کن" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "reload" }));
    expect(screen.getAllByRole("group")).toHaveLength(4);
  });

  it("moves a photo by dragging it onto another", async () => {
    PUT.mockResolvedValue({ data: [] });
    setup();
    fireEvent.pointerDown(screen.getByRole("group", { name: "عکس ۳" }), { pointerId: 1 });
    fireEvent.pointerUp(screen.getByRole("group", { name: "عکس ۱" }), { pointerId: 1 });
    await waitFor(() =>
      expect(PUT).toHaveBeenCalledWith("/api/v1/listings/{listing_id}/photos/order", {
        params: { path: { listing_id: 4 } },
        body: { photo_ids: [3, 1, 2] },
      }),
    );
  });

  it("does not remove a photo when that would leave fewer than 5 (Q1, feature 021)", () => {
    setup("pending", [photo(1, 0), photo(2, 1), photo(3, 2), photo(4, 3), photo(5, 4)]);
    const remove = within(screen.getByRole("group", { name: "عکس ۱" })).getByRole("button", {
      name: "حذف عکس",
    });
    expect(remove).toBeDisabled();
    expect(screen.getByText(/دست‌کم ۵ عکس لازم دارد/)).toBeInTheDocument();
  });

  it("removes one of six after asking", async () => {
    DELETE.mockResolvedValue({ data: undefined, response: new Response(null, { status: 204 }) });
    const six = [photo(1, 0), photo(2, 1), photo(3, 2), photo(4, 3), photo(5, 4), photo(6, 5)];
    const onChange = setup("pending", six);
    await userEvent.click(
      within(screen.getByRole("group", { name: "عکس ۴" })).getByRole("button", { name: "حذف عکس" }),
    );
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "حذف عکس" }));
    await waitFor(() =>
      expect(DELETE).toHaveBeenCalledWith("/api/v1/listings/{listing_id}/photos/{photo_id}", {
        params: { path: { listing_id: 4, photo_id: 4 } },
      }),
    );
    expect(onChange).toHaveBeenCalled();
  });

  it("warns before a new photo or a new label on an approved listing, not before reordering (R8)", async () => {
    PUT.mockResolvedValue({ data: [] });
    PATCH.mockResolvedValue({ data: photo(2, 1, "Kitchen") });
    setup("approved");

    const second = screen.getByRole("group", { name: "عکس ۲" });
    const tag = within(second).getByRole("textbox", { name: "برچسب اتاق" });
    await userEvent.clear(tag);
    await userEvent.type(tag, "Kitchen");
    await userEvent.click(within(second).getByRole("button", { name: "ذخیره‌ی برچسب" }));
    const dialog = await screen.findByRole("dialog", { name: "این تغییر بازبینی می‌خواهد" });
    expect(PATCH).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole("button", { name: "ذخیره و فرستادن برای بازبینی" }));
    await waitFor(() =>
      expect(PATCH).toHaveBeenCalledWith("/api/v1/listings/{listing_id}/photos/{photo_id}", {
        params: { path: { listing_id: 4, photo_id: 2 } },
        body: { room_tag: "Kitchen", caption: null },
      }),
    );

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    // Reordering needs no review: no question.
    await userEvent.click(
      within(screen.getByRole("group", { name: "عکس ۳" })).getByRole("button", { name: "جلوتر" }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(PUT).toHaveBeenCalled();

    await userEvent.upload(screen.getByLabelText("انتخاب عکس‌ها"), [jpeg()]);
    expect(await screen.findByRole("dialog", { name: "این تغییر بازبینی می‌خواهد" })).toBeInTheDocument();
    expect(uploadPhoto).not.toHaveBeenCalled();
  });

  it("is accessible", async () => {
    setup();
    await expectAccessible(document.body);
  });
});
