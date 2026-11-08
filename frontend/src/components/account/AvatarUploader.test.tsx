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

  it("uploads in three steps and shows the preview first (US2/AC10)", async () => {
    POST.mockResolvedValue({
      data: {
        storage_key: "avatars/7/a.png",
        url: `${MEDIA}`,
        fields: { key: "avatars/7/a.png", policy: "p" },
        expires_in: 600,
      },
    });
    storage.mockResolvedValue(new Response(null, { status: 204 }));
    PUT.mockResolvedValue({ data: { ...user, avatar_url: `${MEDIA}/avatars/7/a.png` } });
    renderIn("fa", <AvatarUploader user={user} />);

    await userEvent.upload(screen.getByLabelText("انتخاب عکس"), png());
    expect(await screen.findByRole("img", { name: "پیش‌نمایش عکس تازه" })).toHaveAttribute(
      "src",
      "blob:preview",
    );
    await userEvent.click(screen.getByRole("button", { name: "ذخیره‌ی عکس" }));

    await waitFor(() =>
      expect(PUT).toHaveBeenCalledWith("/api/v1/me/avatar", { body: { storage_key: "avatars/7/a.png" } }),
    );
    expect(POST).toHaveBeenCalledWith("/api/v1/me/avatar/upload-url", {
      body: { content_type: "image/png" },
    });
    const [url, init] = storage.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe(MEDIA);
    const form = init.body as FormData;
    expect([...form.keys()]).toEqual(["key", "policy", "file"]); // fields first, the file last
  });

  it("refuses a wrong file before sending anything (US2/AC11)", async () => {
    renderIn("en", <AvatarUploader user={user} />);
    const input = screen.getByLabelText("Choose a picture");
    await userEvent.upload(input, new File(["just text"], "fake.png", { type: "image/png" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This file is not a PNG or JPEG picture.");
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.png", { type: "image/png" });
    await userEvent.upload(input, big);
    expect(await screen.findByRole("alert")).toHaveTextContent("The picture can be at most 5 MB.");
    expect(POST).not.toHaveBeenCalled();
    expect(storage).not.toHaveBeenCalled();
  });

  it("keeps the current picture when a step fails, with a translated message", async () => {
    POST.mockResolvedValue({
      data: { storage_key: "avatars/7/a.png", url: MEDIA, fields: {}, expires_in: 600 },
    });
    storage.mockResolvedValue(new Response(null, { status: 204 }));
    PUT.mockResolvedValue({ error: { error: { code: "invalid_image", message: "English" } } });
    renderIn("fa", <AvatarUploader user={user} />);
    await userEvent.upload(screen.getByLabelText("انتخاب عکس"), png());
    await userEvent.click(await screen.findByRole("button", { name: "ذخیره‌ی عکس" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("این فایل عکس PNG یا JPEG نیست.");
  });

  it("reports a file storage refused as too large", async () => {
    POST.mockResolvedValue({
      data: { storage_key: "avatars/7/a.png", url: MEDIA, fields: {}, expires_in: 600 },
    });
    storage.mockResolvedValue(new Response("<Error>EntityTooLarge</Error>", { status: 400 }));
    renderIn("en", <AvatarUploader user={user} />);
    await userEvent.upload(screen.getByLabelText("Choose a picture"), png());
    await userEvent.click(await screen.findByRole("button", { name: "Save picture" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The picture can be at most 5 MB.");
    expect(PUT).not.toHaveBeenCalled();
  });

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
