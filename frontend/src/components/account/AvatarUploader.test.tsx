import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { expectAccessible, renderIn } from "@/test/render";

const POST = vi.fn();
const PUT = vi.fn();
const DELETE = vi.fn();
vi.mock("@/api/client", () => ({
  api: {
    POST: (...a: unknown[]) => POST(...a),
    PUT: (...a: unknown[]) => PUT(...a),
    DELETE: (...a: unknown[]) => DELETE(...a),
  },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

import { AvatarUploader } from "./AvatarUploader";

const MEDIA = "http://localhost:9000/caravansara-media";
const user = {
  id: 7,
  email: "a@b.c",
  full_name: "آرش رضایی",
  avatar_url: null,
  created_at: "2026-01-01T00:00:00Z",
};
const png = () => {
  const bytes = new Uint8Array(64);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return new File([bytes], "me.png", { type: "image/png" });
};

describe("AvatarUploader", () => {
  let storage: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    [POST, PUT, DELETE].forEach((m) => m.mockReset());
    storage = vi.fn();
    vi.stubGlobal("fetch", storage);
    URL.createObjectURL = vi.fn(() => "blob:preview");
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("shows the default avatar first (FR-037)", () => {
    renderIn("fa", <AvatarUploader user={user} />);
    expect(screen.getByRole("img", { name: "آرش رضایی" })).toHaveTextContent("آ");
    expect(screen.queryByRole("button", { name: "حذف عکس" })).toBeNull();
  });

  // specs/006-avatar-upload-via-api: one request, the file itself; the API checks it before storing anything.
  it("sends the picture in one PUT and shows the preview first (US2/AC10)", async () => {
    PUT.mockResolvedValue({ data: { ...user, avatar_url: `${MEDIA}/avatars/7/a.png` } });
    renderIn("fa", <AvatarUploader user={user} />);

    const file = png();
    await userEvent.upload(screen.getByLabelText("انتخاب عکس"), file);
    expect(await screen.findByRole("img", { name: "پیش‌نمایش عکس تازه" })).toHaveAttribute(
      "src",
      "blob:preview",
    );
    await userEvent.click(screen.getByRole("button", { name: "ذخیره‌ی عکس" }));

    await waitFor(() => expect(PUT).toHaveBeenCalledTimes(1));
    const [path, options] = PUT.mock.calls[0]! as [
      string,
      { body: File; headers: Record<string, string>; bodySerializer: (b: unknown) => unknown },
    ];
    expect(path).toBe("/api/v1/me/avatar");
    expect(options.body).toBe(file);
    expect(options.headers["content-type"]).toBe("image/png");
    expect(options.bodySerializer(file)).toBe(file); // sent as it is, not as JSON
    expect(POST).not.toHaveBeenCalled(); // no upload address any more
    expect(storage).not.toHaveBeenCalled(); // nothing goes straight to storage
  });

  it("refuses a wrong file before sending anything (US2/AC11)", async () => {
    renderIn("en", <AvatarUploader user={user} />);
    const input = screen.getByLabelText("Choose a picture");
    await userEvent.upload(input, new File(["just text"], "fake.png", { type: "image/png" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This file is not a PNG or JPEG picture.");
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.png", { type: "image/png" });
    await userEvent.upload(input, big);
    expect(await screen.findByRole("alert")).toHaveTextContent("The picture can be at most 5 MB.");
    expect(PUT).not.toHaveBeenCalled();
    expect(storage).not.toHaveBeenCalled();
  });

  it.each([
    ["image_too_large", "عکس حداکثر می‌تواند ۵ مگابایت باشد."],
    ["unsupported_image_type", "فقط عکس PNG یا JPEG پذیرفته می‌شود."],
    ["invalid_image", "این فایل عکس PNG یا JPEG نیست."],
  ])(
    "keeps the current picture when the API refuses it with %s, in the visitor's language",
    async (code, text) => {
      PUT.mockResolvedValue({ error: { error: { code, message: "English" } } });
      renderIn("fa", <AvatarUploader user={user} />);
      await userEvent.upload(screen.getByLabelText("انتخاب عکس"), png());
      await userEvent.click(await screen.findByRole("button", { name: "ذخیره‌ی عکس" }));
      expect(await screen.findByRole("alert")).toHaveTextContent(text);
    },
  );

  it("removes the picture (US2/AC12)", async () => {
    DELETE.mockResolvedValue({ data: user });
    renderIn("en", <AvatarUploader user={{ ...user, avatar_url: `${MEDIA}/avatars/7/old.png` }} />);
    await userEvent.click(screen.getByRole("button", { name: "Remove picture" }));
    expect(DELETE).toHaveBeenCalledWith("/api/v1/me/avatar");
  });

  it("is accessible", async () => {
    const { container } = renderIn("fa", <AvatarUploader user={user} />);
    await expectAccessible(container);
  });
});
